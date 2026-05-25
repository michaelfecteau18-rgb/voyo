// supabase/functions/send-broadcast/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

interface BroadcastPayload {
  message: string
  channels: string[]
  type: string
  org_id?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    // Valider le JWT de l'appelant
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Non autorisé', { status: 401 })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return new Response('Non autorisé', { status: 401 })

    // Vérifier que c'est un dispatcher ou org_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, org_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['org_admin', 'dispatcher', 'super_admin'].includes(profile.role)) {
      return new Response('Accès refusé', { status: 403 })
    }

    const payload: BroadcastPayload = await req.json()
    const { message, channels, type } = payload
    const orgId = profile.org_id!

    if (!message?.trim()) {
      return new Response('Message requis', { status: 400 })
    }

    // Récupérer tous les parents actifs de l'org
    const { data: parents } = await supabase
      .from('profiles')
      .select('id, push_token, phone')
      .eq('org_id', orgId)
      .eq('role', 'parent')
      .eq('is_active', true)

    if (!parents?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
    }

    // Insérer les notifications en batch
    const notifications = parents.map(p => ({
      org_id: orgId,
      recipient_id: p.id,
      type: type as any,
      channel: 'in_app' as const,
      status: 'sent' as const,
      title: 'Message VOYO',
      body: message,
      sent_at: new Date().toISOString(),
    }))

    const BATCH = 1000
    for (let i = 0; i < notifications.length; i += BATCH) {
      await supabase
        .from('notifications')
        .insert(notifications.slice(i, i + BATCH))
    }

    // Push Firebase si demandé
    let pushSent = 0
    if (channels.includes('push')) {
      const tokens = parents.filter(p => p.push_token).map(p => p.push_token!)
      if (tokens.length > 0) {
        const fcmResponse = await fetch(
          'https://fcm.googleapis.com/v1/projects/' + Deno.env.get('FIREBASE_PROJECT_ID') + '/messages:send',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + await getFirebaseToken(),
            },
            body: JSON.stringify({
              message: {
                notification: { title: 'Message VOYO', body: message },
                // Multicast batch (max 500 tokens par appel FCM)
                tokens: tokens.slice(0, 500),
              },
            }),
          }
        )
        if (fcmResponse.ok) pushSent = tokens.length
      }
    }

    return new Response(JSON.stringify({
      sent: parents.length,
      push_sent: pushSent,
      in_app_sent: notifications.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erreur broadcast:', err)
    return new Response('Erreur interne', { status: 500 })
  }
})

async function getFirebaseToken(): Promise<string> {
  // Implémenter l'authentification Firebase Admin via JWT
  // En production: utiliser google-auth-library
  return Deno.env.get('FIREBASE_SERVER_KEY') ?? ''
}
