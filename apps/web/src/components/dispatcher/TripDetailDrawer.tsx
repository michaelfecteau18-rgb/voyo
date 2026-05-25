'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
type ActiveVehicleStatus = any
type Trip = any
type Attendance = any
type TripStop = any

interface TripDetailDrawerProps {
  vehicle: ActiveVehicleStatus
  trip?: Trip
  onClose: () => void
}

export function TripDetailDrawer({ vehicle, trip, onClose }: TripDetailDrawerProps) {
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [tripStops, setTripStops] = useState<TripStop[]>([])
  const [activeTab, setActiveTab] = useState<'trip' | 'students' | 'stops'>('trip')
  const [loading, setLoading] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageText, setMessageText] = useState('')

  useEffect(() => {
    if (!trip?.id) return
    loadTripDetails(trip.id)
  }, [trip?.id])

  const loadTripDetails = async (tripId: string) => {
    setLoading(true)
    const [attRes, stopsRes] = await Promise.all([
      supabase
        .from('attendance')
        .select(`*, student:students(first_name, last_name, photo_url, grade)`)
        .eq('trip_id', tripId)
        .order('scanned_at'),
      supabase
        .from('trip_stops')
        .select(`*, stop:stops(name, address, sequence_order)`)
        .eq('trip_id', tripId)
        .order('sequence_order'),
    ])
    if (attRes.data) setAttendance(attRes.data as unknown as Attendance[])
    if (stopsRes.data) setTripStops(stopsRes.data as unknown as TripStop[])
    setLoading(false)
  }

  const sendDriverMessage = async () => {
    if (!messageText.trim() || !trip) return
    setSendingMessage(true)
    try {
      await supabase.from('messages').insert({
        org_id: trip.org_id,
        conversation_id: trip.id, // Conversation par trajet
        sender_id: (await supabase.auth.getUser()).data.user?.id!,
        recipient_id: vehicle.driver_id,
        trip_id: trip.id,
        body: messageText.trim(),
      })
      setMessageText('')
    } finally {
      setSendingMessage(false)
    }
  }

  const reportDelay = async (minutes: number) => {
    if (!trip) return
    await supabase
      .from('trips')
      .update({ delay_minutes: minutes, status: 'delayed' })
      .eq('id', trip.id)
  }

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      scheduled:  'Planifié',
      en_route:   'En route',
      delayed:    'En retard',
      completed:  'Terminé',
      cancelled:  'Annulé',
      emergency:  'Urgence',
    }
    return map[status] ?? status
  }

  const attendanceStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      boarded:          'À bord',
      absent:           'Absent',
      dropped_off:      'Déposé',
      present_at_school:'À l\'école',
    }
    return map[status] ?? status
  }

  const delay = vehicle.delay_minutes ?? 0

  return (
    <div className="w-96 bg-white border-l border-navy-100 flex flex-col h-full shadow-xl animate-slide-right">
      {/* En-tête */}
      <div className="bg-navy-900 text-white p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-poppins font-semibold text-xl">{vehicle.vehicle_name}</h2>
            {trip && (
              <p className="text-navy-300 text-sm mt-0.5">
                {(trip as any).route?.name ?? 'Route inconnue'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-navy-800 rounded-lg transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Statut */}
        <div className="flex items-center gap-3">
          <span className={cn(
            'badge text-sm font-medium',
            vehicle.trip_status === 'en_route' ? 'bg-green-500/20 text-green-300' :
            vehicle.trip_status === 'delayed'  ? 'bg-amber-500/20 text-amber-300' :
            vehicle.trip_status === 'emergency'? 'bg-red-500/20 text-red-300' :
                                                 'bg-navy-700 text-navy-300'
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              vehicle.trip_status === 'en_route' ? 'bg-green-400' :
              vehicle.trip_status === 'delayed'  ? 'bg-amber-400' :
              vehicle.trip_status === 'emergency'? 'bg-red-400' : 'bg-navy-400'
            )} />
            {statusLabel(vehicle.trip_status ?? 'scheduled')}
          </span>

          {delay > 0 && (
            <span className="text-amber-300 text-sm font-medium">
              +{delay} min de retard
            </span>
          )}
        </div>

        {/* Chauffeur */}
        {vehicle.driver_name && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-navy-800">
            <div className="w-9 h-9 rounded-full bg-navy-800 flex items-center justify-center text-sm font-semibold text-navy-300">
              {vehicle.driver_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{vehicle.driver_name}</p>
              <p className="text-xs text-navy-400">Chauffeur</p>
            </div>
            <a
              href={`tel:${vehicle.driver_id}`}
              className="p-2 hover:bg-navy-800 rounded-lg transition-colors"
            >
              <PhoneIcon />
            </a>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="flex border-b border-navy-100">
        {(['trip', 'students', 'stops'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'text-teal-600 border-b-2 border-teal-500'
                : 'text-navy-500 hover:text-navy-700'
            )}
          >
            {tab === 'trip' ? 'Trajet' : tab === 'students' ? `Élèves (${attendance.length})` : 'Arrêts'}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && activeTab === 'trip' && trip && (
          <div className="p-4 space-y-4">
            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface rounded-lg p-3 text-center">
                <p className="font-poppins font-semibold text-xl text-navy-900">{trip.students_boarded}</p>
                <p className="text-xs text-navy-500 mt-0.5">À bord</p>
              </div>
              <div className="bg-surface rounded-lg p-3 text-center">
                <p className="font-poppins font-semibold text-xl text-danger">{trip.students_absent}</p>
                <p className="text-xs text-navy-500 mt-0.5">Absents</p>
              </div>
              <div className="bg-surface rounded-lg p-3 text-center">
                <p className="font-poppins font-semibold text-xl text-navy-900">{trip.students_total}</p>
                <p className="text-xs text-navy-500 mt-0.5">Total</p>
              </div>
            </div>

            {/* Horaires */}
            <div className="card">
              <h3 className="font-medium text-sm text-navy-700 mb-3">Horaires</h3>
              <div className="space-y-2">
                {[
                  { label: 'Départ prévu', value: trip.scheduled_start ? format(new Date(trip.scheduled_start), 'HH:mm') : '—' },
                  { label: 'Départ réel', value: trip.actual_start ? format(new Date(trip.actual_start), 'HH:mm') : '—' },
                  { label: 'Arrivée prévue', value: trip.estimated_end ? format(new Date(trip.estimated_end), 'HH:mm') : '—' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-navy-500">{row.label}</span>
                    <span className="font-medium text-navy-900">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vitesse GPS */}
            {vehicle.speed_kmh !== null && (
              <div className="card">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-navy-500">Vitesse actuelle</span>
                  <span className="font-poppins font-semibold text-navy-900">
                    {Math.round(vehicle.speed_kmh ?? 0)} km/h
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-navy-500">Dernière mise à jour</span>
                  <span className="text-xs text-navy-400">
                    {vehicle.last_update
                      ? formatDistanceToNow(new Date(vehicle.last_update), { locale: fr, addSuffix: true })
                      : '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Actions retard */}
            {vehicle.trip_status === 'en_route' && (
              <div className="card">
                <h3 className="font-medium text-sm text-navy-700 mb-3">Signaler un retard</h3>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map(min => (
                    <button
                      key={min}
                      onClick={() => reportDelay(min)}
                      className="flex-1 py-2 text-xs font-medium border border-amber-200 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      +{min}m
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'students' && (
          <div className="p-4">
            {attendance.length === 0 ? (
              <div className="text-center py-8 text-navy-400">
                <p className="text-sm">Aucune présence enregistrée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendance.map(att => {
                  const student = (att as any).student
                  return (
                    <div key={att.id} className="flex items-center gap-3 p-3 bg-surface rounded-lg">
                      {student?.photo_url ? (
                        <img src={student.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center text-xs font-semibold text-teal-700">
                          {student?.first_name?.[0]}{student?.last_name?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-navy-900 truncate">
                          {student?.first_name} {student?.last_name}
                        </p>
                        <p className="text-xs text-navy-400">
                          {student?.grade && `Grade ${student.grade} · `}
                          {format(new Date(att.scanned_at), 'HH:mm')}
                        </p>
                      </div>
                      <span className={cn(
                        'badge text-xs',
                        att.status === 'boarded'     ? 'badge-success' :
                        att.status === 'absent'      ? 'badge-danger' :
                        att.status === 'dropped_off' ? 'badge-info' : 'badge-neutral'
                      )}>
                        {attendanceStatusLabel(att.status)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'stops' && (
          <div className="p-4">
            <div className="relative">
              <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-navy-100" />
              <div className="space-y-3">
                {tripStops.map((ts, i) => {
                  const stop = (ts as any).stop
                  return (
                    <div key={ts.id} className="flex items-start gap-4">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2',
                        ts.is_completed
                          ? 'bg-success border-success text-white'
                          : i === tripStops.findIndex(s => !s.is_completed)
                          ? 'bg-teal-500 border-teal-500 text-white animate-pulse-dot'
                          : 'bg-white border-navy-200 text-navy-400'
                      )}>
                        {ts.is_completed ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <span className="text-xs font-semibold">{i + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <p className={cn(
                          'font-medium text-sm',
                          ts.is_completed ? 'text-navy-400' : 'text-navy-900'
                        )}>
                          {stop?.name}
                        </p>
                        {stop?.address && (
                          <p className="text-xs text-navy-400 truncate">{stop.address}</p>
                        )}
                        <div className="flex gap-3 mt-1">
                          {ts.scheduled_time && (
                            <span className="text-xs text-navy-400">
                              Prévu {format(new Date(ts.scheduled_time), 'HH:mm')}
                            </span>
                          )}
                          {ts.arrived_at && (
                            <span className={cn('text-xs font-medium', ts.delay_minutes > 0 ? 'text-warning' : 'text-success')}>
                              Arrivé {format(new Date(ts.arrived_at), 'HH:mm')}
                              {ts.delay_minutes > 0 && ` (+${ts.delay_minutes}m)`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messagerie chauffeur */}
      <div className="border-t border-navy-100 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendDriverMessage()}
            placeholder="Message au chauffeur…"
            className="input text-sm py-2"
          />
          <button
            onClick={sendDriverMessage}
            disabled={!messageText.trim() || sendingMessage}
            className="btn-secondary py-2 px-3 shrink-0"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.18a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.29a16 16 0 006.72 6.72l1.06-1.06a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>
)

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
