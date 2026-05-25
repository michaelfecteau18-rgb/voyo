'use client'

import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
type ActiveVehicleStatus = any
type Trip = any

interface VehicleListProps {
  vehicles: ActiveVehicleStatus[]
  trips: Trip[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
}

export function VehicleList({ vehicles, trips, selectedId, onSelect, loading }: VehicleListProps) {
  if (loading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-navy-50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (vehicles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 bg-navy-50 rounded-full flex items-center justify-center mb-3">
          <BusIcon />
        </div>
        <p className="text-sm font-medium text-navy-700">Aucun véhicule actif</p>
        <p className="text-xs text-navy-400 mt-1">Les trajets du jour apparaîtront ici</p>
      </div>
    )
  }

  // Trier: urgences d'abord, puis retards, puis en route, puis inactifs
  const sorted = [...vehicles].sort((a, b) => {
    const priority = (v: ActiveVehicleStatus) => {
      if (v.trip_status === 'emergency') return 0
      if ((v.delay_minutes ?? 0) > 10) return 1
      if ((v.delay_minutes ?? 0) > 0) return 2
      if (v.trip_status === 'en_route') return 3
      return 4
    }
    return priority(a) - priority(b)
  })

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {sorted.map(vehicle => {
        const trip = trips.find(t => t.vehicle_id === vehicle.vehicle_id)
        const isSelected = vehicle.vehicle_id === selectedId
        const delay = vehicle.delay_minutes ?? 0
        const isEmergency = vehicle.trip_status === 'emergency'
        const isDelayed = delay > 5
        const isActive = vehicle.trip_status === 'en_route' || vehicle.trip_status === 'delayed'

        return (
          <button
            key={vehicle.vehicle_id}
            onClick={() => onSelect(vehicle.vehicle_id)}
            className={cn(
              'w-full text-left px-4 py-3.5 border-b border-navy-50',
              'transition-colors duration-100 hover:bg-navy-50',
              isSelected && 'bg-teal-50 border-l-2 border-l-teal-500',
              isEmergency && 'bg-red-50 border-l-2 border-l-danger'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Indicateur statut */}
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                isEmergency ? 'bg-red-100' :
                isDelayed   ? 'bg-amber-100' :
                isActive    ? 'bg-green-100' : 'bg-navy-100'
              )}>
                <span className={cn(
                  'text-base',
                  isEmergency ? 'text-danger' :
                  isDelayed   ? 'text-warning' :
                  isActive    ? 'text-success' : 'text-navy-400'
                )}>
                  🚌
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-navy-900 truncate">
                    {vehicle.vehicle_name}
                  </p>
                  {/* Badge statut */}
                  <span className={cn(
                    'shrink-0 text-xs font-medium px-2 py-0.5 rounded-full',
                    isEmergency ? 'bg-red-100 text-danger' :
                    isDelayed   ? 'bg-amber-100 text-warning' :
                    isActive    ? 'bg-green-100 text-success' :
                                  'bg-navy-100 text-navy-500'
                  )}>
                    {isEmergency ? 'Urgence' :
                     isDelayed   ? `+${delay}min` :
                     isActive    ? 'En route' : 'Inactif'}
                  </span>
                </div>

                {/* Chauffeur */}
                {vehicle.driver_name && (
                  <p className="text-xs text-navy-500 truncate mt-0.5">
                    {vehicle.driver_name}
                  </p>
                )}

                {/* Trajet + élèves */}
                {trip && (
                  <div className="flex items-center gap-3 mt-1.5">
                    {trip.students_boarded > 0 && (
                      <span className="text-xs text-navy-400">
                        {trip.students_boarded}/{trip.students_total} élèves
                      </span>
                    )}
                    {vehicle.last_update && (
                      <span className="text-xs text-navy-300">
                        {formatDistanceToNow(new Date(vehicle.last_update), { locale: fr, addSuffix: true })}
                      </span>
                    )}
                  </div>
                )}

                {/* Vitesse */}
                {isActive && vehicle.speed_kmh !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className={cn(
                      'inline-block w-1.5 h-1.5 rounded-full',
                      isActive ? 'bg-success animate-pulse-dot' : 'bg-navy-300'
                    )} />
                    <span className="text-xs text-navy-400">
                      {Math.round(vehicle.speed_kmh ?? 0)} km/h
                    </span>
                  </div>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

const BusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-navy-300">
    <path d="M17 8C8 10 5.9 16.17 3.82 20.83L5.71 22l1-2.3A4.49 4.49 0 008 20c4 0 4-2 8-2s4 2 8 2l1-2C23 14 19 6 17 8zm-8 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm8 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
  </svg>
)
