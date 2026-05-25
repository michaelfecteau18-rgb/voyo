'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
type ActiveVehicleStatus = any
type Trip = any
type Notification = any

// Composants
import { DispatcherSidebar } from '@/components/dispatcher/Sidebar'
import { FleetMap } from '@/components/dispatcher/FleetMap'
import { VehicleList } from '@/components/dispatcher/VehicleList'
import { AlertsPanel } from '@/components/dispatcher/AlertsPanel'
import { TripDetailDrawer } from '@/components/dispatcher/TripDetailDrawer'
import { BroadcastModal } from '@/components/dispatcher/BroadcastModal'
import { MetricsBar } from '@/components/dispatcher/MetricsBar'
import { cn } from '@/lib/utils'

export default function DispatcherDashboard() {
  const [vehicles, setVehicles] = useState<ActiveVehicleStatus[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [activeTrips, setActiveTrips] = useState<Trip[]>([])
  const [alerts, setAlerts] = useState<Notification[]>([])
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Charger les données initiales
  useEffect(() => {
    loadDashboardData()
  }, [])

  // Supabase Realtime — positions GPS
  useEffect(() => {
    const channel = supabase
      .channel('fleet-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gps_locations' },
        (payload) => {
          const { vehicle_id, lat, lng, speed_kmh } = payload.new
          setVehicles(prev =>
            prev.map(v =>
              v.vehicle_id === vehicle_id
                ? { ...v, lat, lng, speed_kmh, last_update: new Date().toISOString() }
                : v
            )
          )
          setLastUpdate(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips' },
        (payload) => {
          const updated = payload.new as Trip
          setActiveTrips(prev =>
            prev.map(t => t.id === updated.id ? { ...t, ...updated } : t)
          )
          // Si retard détecté
          if (updated.delay_minutes && updated.delay_minutes > 5) {
            addAlert({
              type: 'delay_alert',
              title: 'Retard détecté',
              body: `${updated.delay_minutes} min de retard sur la route`,
              trip_id: updated.id,
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance' },
        (payload) => {
          setLastUpdate(new Date())
          updateStudentCount(payload.new)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [vehiclesRes, tripsRes, alertsRes] = await Promise.all([
        supabase.from('active_vehicle_status').select('*'),
        supabase
          .from('trips')
          .select(`
            *,
            route:routes(name, route_type, color),
            vehicle:vehicles(name, plate_number),
            driver:drivers(id, profile:profiles(first_name, last_name, phone))
          `)
          .eq('trip_date', new Date().toISOString().split('T')[0])
          .not('status', 'in', '(completed,cancelled)')
          .order('scheduled_start'),
        supabase
          .from('notifications')
          .select('*')
          .in('type', ['delay_alert', 'emergency'])
          .eq('status', 'sent')
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (vehiclesRes.data) setVehicles(vehiclesRes.data)
      if (tripsRes.data) setActiveTrips(tripsRes.data as unknown as Trip[])
      if (alertsRes.data) setAlerts(alertsRes.data)
    } finally {
      setLoading(false)
    }
  }

  const addAlert = (alert: Partial<Notification>) => {
    setAlerts(prev => [{ id: Math.random().toString(), created_at: new Date().toISOString(), ...alert } as Notification, ...prev.slice(0, 19)])
  }

  const updateStudentCount = (attendance: Record<string, unknown>) => {
    setActiveTrips(prev =>
      prev.map(t => {
        if (t.id !== attendance.trip_id) return t
        if (attendance.status === 'boarded') return { ...t, students_boarded: t.students_boarded + 1 }
        if (attendance.status === 'absent') return { ...t, students_absent: t.students_absent + 1 }
        return t
      })
    )
  }

  const selectedVehicle = vehicles.find(v => v.vehicle_id === selectedVehicleId)
  const selectedTrip = activeTrips.find(t => t.vehicle_id === selectedVehicleId)

  // Métriques
  const totalVehicles = vehicles.length
  const activeVehicles = vehicles.filter(v => v.trip_status === 'en_route').length
  const delayedVehicles = vehicles.filter(v => (v.delay_minutes ?? 0) > 5).length
  const totalStudents = activeTrips.reduce((acc, t) => acc + t.students_total, 0)
  const boardedStudents = activeTrips.reduce((acc, t) => acc + t.students_boarded, 0)

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Sidebar navigation */}
      <DispatcherSidebar />

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Barre supérieure */}
        <header className="bg-white border-b border-navy-100 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-poppins font-semibold text-xl text-navy-900">
                Tableau de bord répartiteur
              </h1>
              <p className="text-sm text-navy-400">
                {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
              </p>
            </div>

            {/* Indicateur temps réel */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
              <span className="status-dot-live" />
              <span className="text-xs font-medium text-green-700">
                En direct · {formatDistanceToNow(lastUpdate, { locale: fr, addSuffix: false })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBroadcast(true)}
              className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
            >
              <BroadcastIcon />
              Diffusion
            </button>
            <button
              onClick={loadDashboardData}
              className="btn-ghost p-2"
              title="Rafraîchir"
            >
              <RefreshIcon />
            </button>
          </div>
        </header>

        {/* Métriques */}
        <MetricsBar
          totalVehicles={totalVehicles}
          activeVehicles={activeVehicles}
          delayedVehicles={delayedVehicles}
          totalStudents={totalStudents}
          boardedStudents={boardedStudents}
          activeTrips={activeTrips.length}
        />

        {/* Zone principale */}
        <div className="flex-1 flex overflow-hidden">
          {/* Liste véhicules */}
          <aside className="w-80 bg-white border-r border-navy-100 flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-navy-100">
              <h2 className="font-poppins font-semibold text-base text-navy-900">
                Flotte active
              </h2>
              <p className="text-xs text-navy-400 mt-0.5">
                {activeVehicles} véhicules en route
              </p>
            </div>

            <VehicleList
              vehicles={vehicles}
              trips={activeTrips}
              selectedId={selectedVehicleId}
              onSelect={(id) => {
                setSelectedVehicleId(id)
                setDrawerOpen(true)
              }}
              loading={loading}
            />

            {/* Panneau d'alertes */}
            <AlertsPanel alerts={alerts} />
          </aside>

          {/* Carte */}
          <main className="flex-1 relative">
            <FleetMap
              vehicles={vehicles}
              trips={activeTrips}
              selectedVehicleId={selectedVehicleId}
              onVehicleSelect={(id) => {
                setSelectedVehicleId(id)
                setDrawerOpen(true)
              }}
            />

            {/* Légende */}
            <div className="map-card glass bottom-6 left-6 text-sm">
              <p className="font-medium text-navy-900 mb-2">Statut</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-navy-600">En route</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-warning" />
                  <span className="text-navy-600">En retard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-danger" />
                  <span className="text-navy-600">Urgence</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Tiroir détail trajet */}
      {drawerOpen && selectedVehicle && (
        <TripDetailDrawer
          vehicle={selectedVehicle}
          trip={selectedTrip}
          onClose={() => {
            setDrawerOpen(false)
            setSelectedVehicleId(null)
          }}
        />
      )}

      {/* Modal diffusion */}
      {showBroadcast && (
        <BroadcastModal onClose={() => setShowBroadcast(false)} />
      )}
    </div>
  )
}

// Icônes inline simples
const BroadcastIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.18a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.29a16 16 0 006.72 6.72l1.06-1.06a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>
)

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
)
