import twilio from 'twilio'
import admin from 'firebase-admin'
import { createServerClient } from '@voyo/db'
import type {
  NotificationType, NotificationChannel, Profile, Student, Trip,
} from '@voyo/types'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

// Initialiser Firebase Admin (une seule fois)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  })
}

// ============================================================
// Gabarits de notifications en français
// ============================================================

interface NotificationContext {
  studentName: string
  busName: string
  stopName?: string
  eta?: string
  delayMinutes?: number
  driverName?: string
  schoolName?: string
}

const TEMPLATES: Record<NotificationType, (ctx: NotificationContext) => { title: string; body: string }> = {
  bus_departed: ({ busName, studentName }) => ({
    title: '🚌 L\'autobus est parti',
    body: `${busName} est en route pour ramasser ${studentName}. Soyez prêt·e!`,
  }),
  bus_approaching: ({ busName, studentName, eta }) => ({
    title: '📍 L\'autobus approche',
    body: `${busName} arrive dans environ ${eta} min pour ${studentName}`,
  }),
  student_boarded: ({ studentName, busName }) => ({
    title: '✅ Embarquement confirmé',
    body: `${studentName} est monté·e à bord de ${busName}`,
  }),
  student_absent: ({ studentName }) => ({
    title: '⚠️ Absence détectée',
    body: `${studentName} n'a pas embarqué à l'arrêt prévu. Veuillez contacter l'école.`,
  }),
  student_dropped_off: ({ studentName, stopName }) => ({
    title: '📍 Dépôt confirmé',
    body: `${studentName} a été déposé·e à ${stopName ?? 'destination'}`,
  }),
  arrival_at_school: ({ studentName, schoolName }) => ({
    title: '🏫 Arrivé·e à l\'école',
    body: `${studentName} est arrivé·e à ${schoolName ?? 'l\'école'} sain·e et sauf·ve`,
  }),
  delay_alert: ({ busName, delayMinutes }) => ({
    title: '⏰ Retard signalé',
    body: `${busName} a ${delayMinutes} min de retard sur l'horaire prévu`,
  }),
  emergency: ({ busName }) => ({
    title: '🚨 Alerte urgence',
    body: `Une urgence a été signalée sur ${busName}. Le répartiteur vous contactera bientôt.`,
  }),
  route_change: ({ busName }) => ({
    title: '🔄 Changement d\'itinéraire',
    body: `L'itinéraire de ${busName} a été modifié. Consultez l'application pour les détails.`,
  }),
  weather_alert: ({ busName }) => ({
    title: '⛈️ Alerte météo',
    body: `Des conditions météo difficiles peuvent affecter ${busName}. Des retards sont possibles.`,
  }),
  custom: ({ studentName }) => ({
    title: 'Message VOYO',
    body: `Mise à jour concernant ${studentName}`,
  }),
}

// ============================================================
// Service principal
// ============================================================

export class NotificationService {
  private supabase = createServerClient(process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Envoyer une notification à un parent
  async notify({
    orgId,
    recipientId,
    studentId,
    tripId,
    type,
    context,
    channels = ['in_app', 'push'],
  }: {
    orgId: string
    recipientId: string
    studentId?: string
    tripId?: string
    type: NotificationType
    context: NotificationContext
    channels?: NotificationChannel[]
  }) {
    const template = TEMPLATES[type](context)

    // Récupérer le profil du destinataire
    const { data: recipient } = await this.supabase
      .from('profiles')
      .select('push_token, phone')
      .eq('id', recipientId)
      .single()

    if (!recipient) return

    const results = await Promise.allSettled([
      // Notification in-app (toujours)
      this.saveToDatabase({
        orgId, recipientId, studentId, tripId, type,
        channel: 'in_app', template,
      }),

      // Push Firebase
      channels.includes('push') && recipient.push_token
        ? this.sendPush(recipient.push_token, template, { tripId, studentId, type })
        : Promise.resolve(),

      // SMS Twilio
      channels.includes('sms') && recipient.phone
        ? this.sendSMS(recipient.phone, template.body)
        : Promise.resolve(),
    ])

    return results
  }

  // Diffusion à tous les parents d'une org
  async broadcast({
    orgId,
    type,
    context,
    tripId,
  }: {
    orgId: string
    type: NotificationType
    context: NotificationContext
    tripId?: string
  }) {
    const { data: parents } = await this.supabase
      .from('profiles')
      .select('id, push_token, phone')
      .eq('org_id', orgId)
      .eq('role', 'parent')
      .eq('is_active', true)

    if (!parents?.length) return

    // Envoyer en batch (max 500 par batch)
    const BATCH = 500
    for (let i = 0; i < parents.length; i += BATCH) {
      const batch = parents.slice(i, i + BATCH)
      await Promise.allSettled(
        batch.map(parent =>
          this.notify({ orgId, recipientId: parent.id, tripId, type, context })
        )
      )
    }
  }

  // Notifications automatiques selon les événements de présence
  async handleAttendanceEvent({
    orgId, tripId, studentId, status, stopName,
  }: {
    orgId: string
    tripId: string
    studentId: string
    status: string
    stopName?: string
  }) {
    // Trouver les parents de l'élève
    const { data: parentLinks } = await this.supabase
      .from('parent_students')
      .select('parent_id, student:students(first_name, last_name)')
      .eq('student_id', studentId)

    if (!parentLinks?.length) return

    const student = (parentLinks[0] as any).student
    const studentName = `${student.first_name} ${student.last_name}`

    // Trouver le véhicule
    const { data: trip } = await this.supabase
      .from('trips')
      .select('vehicle:vehicles(name)')
      .eq('id', tripId)
      .single()

    const busName = (trip as any)?.vehicle?.name ?? 'l\'autobus'

    const typeMap: Record<string, NotificationType> = {
      boarded:     'student_boarded',
      absent:      'student_absent',
      dropped_off: 'student_dropped_off',
    }

    const type = typeMap[status]
    if (!type) return

    // Notifier tous les parents de l'élève
    await Promise.allSettled(
      parentLinks.map(link =>
        this.notify({
          orgId,
          recipientId: link.parent_id,
          studentId,
          tripId,
          type,
          context: { studentName, busName, stopName },
        })
      )
    )
  }

  private async saveToDatabase({
    orgId, recipientId, studentId, tripId, type, channel, template,
  }: {
    orgId: string
    recipientId: string
    studentId?: string
    tripId?: string
    type: NotificationType
    channel: NotificationChannel
    template: { title: string; body: string }
  }) {
    return this.supabase.from('notifications').insert({
      org_id: orgId,
      recipient_id: recipientId,
      student_id: studentId,
      trip_id: tripId,
      type,
      channel,
      status: 'sent',
      title: template.title,
      body: template.body,
      sent_at: new Date().toISOString(),
    })
  }

  private async sendPush(
    token: string,
    template: { title: string; body: string },
    data: Record<string, any>
  ) {
    return admin.messaging().send({
      token,
      notification: { title: template.title, body: template.body },
      data: {
        tripId: data.tripId ?? '',
        studentId: data.studentId ?? '',
        type: data.type ?? '',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'content-available': 1,
          },
        },
      },
      android: {
        notification: {
          sound: 'default',
          priority: 'high',
          channelId: 'voyo_alerts',
        },
      },
    })
  }

  private async sendSMS(phone: string, body: string) {
    // Limiter à 160 chars pour SMS simple
    const smsBody = body.length > 155 ? body.slice(0, 155) + '…' : body
    return twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
      body: `VOYO: ${smsBody}`,
    })
  }
}

export const notificationService = new NotificationService()
