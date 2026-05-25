// supabase/functions/gps-processor/index.ts
// Fonction déclenchée par webhook à chaque insertion GPS

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  isInsideGeofence,
  shouldSendApproachNotification,
  calculateSchoolETA,
  calculateDelay,
} from "./eta.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

interface GpsEvent {
  type: 'INSERT'
  table: 'gps_locations'
  record: {
    id: number
    trip_id: string
    vehicle_id: string
    lat: number
    lng: number
    speed_kmh: number | null
    heading: number | null
    recorded_at: string
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Méthode non autorisée', { status: 405 })
  }

  const event: GpsEvent = await req.json()
  const { record: gps } = event

  try {
    await processGpsUpdate(gps)
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Erreur GPS processor:', err)
    return new Response('Erreur interne', { status: 500 })
  }
})

async function processGpsUpdate(gps: GpsEvent['record']) {
  // 1. Charger le trajet et ses arrêts restants
  const { data: trip } = await supabase
    .from('trips')
    .select(`
      *,
      route:routes(
        school:schools(id, name, location)
      ),
      trip_stops:trip_stops(
        *,
        stop:stops(id, name, location, geofence_radius, sequence_order)
      )
    `)
    .eq('id', gps.trip_id)
    .eq('status', 'en_route')
    .single()

  if (!trip) return

  const pendingStops = trip.trip_stops
    .filter((ts: any) => !ts.is_completed)
    .sort((a: any, b: any) => a.sequence_order - b.sequence_order)

  if (pendingStops.length === 0) return

  const nextStop = pendingStops[0]

  // 2. Vérifier géofence prochain arrêt
  if (nextStop.stop.location) {
    const stopCoords = parsePoint(nextStop.stop.location)
    if (stopCoords) {
      // Détection d'arrivée à l'arrêt
      if (isInsideGeofence(gps.lat, gps.lng, stopCoords.lat, stopCoords.lng, nextStop.stop.geofence_radius)) {
        await handleStopArrival(gps.trip_id, nextStop.stop.id, trip)
      }

      // Notification d'approche (500m)
      const alreadyNotified = await checkApproachNotified(gps.trip_id, nextStop.stop.id)
      if (!alreadyNotified && shouldSendApproachNotification(gps.lat, gps.lng, stopCoords.lat, stopCoords.lng)) {
        await sendApproachNotifications(gps.trip_id, nextStop.stop, trip)
      }
    }
  }

  // 3. Recalculer ETA école
  const school = trip.route?.school
  if (school?.location) {
    const schoolCoords = parsePoint(school.location)
    if (schoolCoords) {
      const remainingForETA = pendingStops.map((ts: any) => {
        const coords = parsePoint(ts.stop.location)
        return {
          lat: coords?.lat ?? 0,
          lng: coords?.lng ?? 0,
          studentCount: 3, // Estimation moyenne
        }
      })

      const eta = calculateSchoolETA({
        currentLat: gps.lat,
        currentLng: gps.lng,
        currentSpeed: gps.speed_kmh,
        remainingStops: remainingForETA,
        schoolLat: schoolCoords.lat,
        schoolLng: schoolCoords.lng,
      })

      // Mettre à jour ETA dans la DB
      await supabase
        .from('trips')
        .update({ estimated_end: eta.toISOString() })
        .eq('id', gps.trip_id)

      // Vérifier retard
      if (trip.scheduled_end) {
        const delay = calculateDelay(new Date(trip.scheduled_end), eta)
        if (delay > 5 && delay !== trip.delay_minutes) {
          await supabase
            .from('trips')
            .update({ delay_minutes: delay, status: delay > 15 ? 'delayed' : 'en_route' })
            .eq('id', gps.trip_id)
        }
      }
    }
  }

  // 4. Vérifier géofence école (arrivée finale)
  if (school?.location) {
    const schoolCoords = parsePoint(school.location)
    if (schoolCoords && isInsideGeofence(gps.lat, gps.lng, schoolCoords.lat, schoolCoords.lng, 200)) {
      await handleSchoolArrival(gps.trip_id, school.id, school.name, trip)
    }
  }
}

async function handleStopArrival(tripId: string, stopId: string, trip: any) {
  // Marquer l'arrêt comme atteint
  const { error } = await supabase
    .from('trip_stops')
    .update({ arrived_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .eq('stop_id', stopId)
    .is('arrived_at', null) // Éviter les doublons

  if (error) return // Déjà traité
}

async function sendApproachNotifications(tripId: string, stop: any, trip: any) {
  // Trouver les élèves à cet arrêt et leurs parents
  const { data: studentStops } = await supabase
    .from('student_stops')
    .select(`
      student:students(
        id, first_name, last_name,
        parent_students:parent_students(parent_id)
      )
    `)
    .eq('stop_id', stop.id)
    .eq('stop_type', 'pickup')

  if (!studentStops?.length) return

  const vehicle = trip.vehicle_id
    ? await supabase.from('vehicles').select('name').eq('id', trip.vehicle_id).single()
    : null

  const busName = vehicle?.data?.name ?? 'L\'autobus'

  for (const ss of studentStops) {
    const student = (ss as any).student
    const studentName = `${student.first_name} ${student.last_name}`

    for (const ps of student.parent_students) {
      await supabase.from('notifications').insert({
        org_id: trip.org_id,
        recipient_id: ps.parent_id,
        student_id: student.id,
        trip_id: tripId,
        type: 'bus_approaching',
        channel: 'in_app',
        status: 'sent',
        title: '📍 L\'autobus approche',
        body: `${busName} approche de l'arrêt pour ${studentName}. Soyez prêt·e!`,
        data: { stop_id: stop.id, trip_id: tripId },
        sent_at: new Date().toISOString(),
      })
    }
  }

  // Marquer comme notifié pour éviter doublons
  await supabase.from('trip_stops').update({
    // Ajouter un champ approch_notified_at si besoin
  }).eq('trip_id', tripId).eq('stop_id', stop.id)
}

async function handleSchoolArrival(
  tripId: string, schoolId: string, schoolName: string, trip: any
) {
  // Marquer le trajet comme terminé
  await supabase
    .from('trips')
    .update({ status: 'completed', actual_end: new Date().toISOString() })
    .eq('id', tripId)
    .eq('status', 'en_route') // Éviter doublons

  // Notifier tous les parents du trajet
  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      student_id,
      student:students(
        first_name, last_name,
        parent_students:parent_students(parent_id)
      )
    `)
    .eq('trip_id', tripId)
    .eq('status', 'boarded')

  if (!attendance?.length) return

  for (const att of attendance) {
    const student = (att as any).student
    const studentName = `${student.first_name} ${student.last_name}`

    // Mettre à jour présence
    await supabase
      .from('attendance')
      .update({ status: 'present_at_school' })
      .eq('trip_id', tripId)
      .eq('student_id', att.student_id)

    // Notifier les parents
    for (const ps of student.parent_students) {
      await supabase.from('notifications').insert({
        org_id: trip.org_id,
        recipient_id: ps.parent_id,
        student_id: att.student_id,
        trip_id: tripId,
        type: 'arrival_at_school',
        channel: 'in_app',
        status: 'sent',
        title: '🏫 Arrivé·e à l\'école',
        body: `${studentName} est arrivé·e à ${schoolName} sain·e et sauf·ve ✅`,
        sent_at: new Date().toISOString(),
      })
    }
  }
}

async function checkApproachNotified(tripId: string, stopId: string): Promise<boolean> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .eq('type', 'bus_approaching')
    .contains('data', { stop_id: stopId })

  return (count ?? 0) > 0
}

// Parser une colonne PostGIS GEOGRAPHY en {lat, lng}
function parsePoint(location: any): { lat: number; lng: number } | null {
  if (!location) return null
  // Format GeoJSON de Supabase: { coordinates: [lng, lat] }
  if (location.coordinates) {
    return { lat: location.coordinates[1], lng: location.coordinates[0] }
  }
  return null
}
