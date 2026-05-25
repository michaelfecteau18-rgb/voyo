import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TripStatus } from '@voyo/types'

interface TripUpdate {
  trip_id: string
  status?: TripStatus
  delay_minutes?: number
  estimated_end?: string | null
  students_boarded?: number
}

interface GpsUpdate {
  trip_id: string
  vehicle_id: string
  lat: number
  lng: number
  speed_kmh: number | null
  heading: number | null
  recorded_at: string
}

// Hook parent: suivre les trajets de ses enfants en temps réel
export function useRealtimeTrip(
  tripIds: string[],
  onTripUpdate: (tripId: string, update: Partial<TripUpdate>) => void,
  onGpsUpdate?: (update: GpsUpdate) => void
) {
  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (tripIds.length === 0) return

    const channel = supabase
      .channel(`parent-trips-${tripIds.join('-')}`)
      // Mises à jour statut trajet
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=in.(${tripIds.join(',')})`,
        },
        (payload) => {
          const { id, status, delay_minutes, estimated_end, students_boarded } = payload.new
          onTripUpdate(id, { trip_id: id, status, delay_minutes, estimated_end, students_boarded })
        }
      )
      // Nouvelles positions GPS
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gps_locations',
          filter: `trip_id=in.(${tripIds.join(',')})`,
        },
        (payload) => {
          if (onGpsUpdate) {
            onGpsUpdate(payload.new as GpsUpdate)
          }
        }
      )
      // Présence élèves
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `trip_id=in.(${tripIds.join(',')})`,
        },
        (payload) => {
          const { trip_id, status } = payload.new
          if (status === 'boarded' || status === 'dropped_off') {
            onTripUpdate(trip_id, { trip_id })
          }
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [tripIds.join(',')])
}

// Hook répartiteur: surveiller toute la flotte
export function useRealtimeFleet(orgId: string, callbacks: {
  onGps: (data: GpsUpdate) => void
  onTrip: (data: TripUpdate) => void
  onAttendance: (data: { trip_id: string; student_id: string; status: string }) => void
}) {
  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`fleet-${orgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gps_locations' },
        (p) => callbacks.onGps(p.new as GpsUpdate)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips' },
        (p) => callbacks.onTrip(p.new as TripUpdate)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance' },
        (p) => callbacks.onAttendance(p.new as any)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orgId])
}

// Hook chauffeur: écouter les messages du répartiteur
export function useDriverMessages(
  tripId: string,
  onMessage: (msg: { body: string; sender: string; created_at: string }) => void
) {
  useEffect(() => {
    if (!tripId) return

    const channel = supabase
      .channel(`driver-messages-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          onMessage({
            body: payload.new.body,
            sender: 'Répartiteur',
            created_at: payload.new.created_at,
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId])
}
