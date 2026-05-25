'use client'

import { cn } from '@/lib/utils'

interface MetricsBarProps {
  totalVehicles:   number
  activeVehicles:  number
  delayedVehicles: number
  totalStudents:   number
  boardedStudents: number
  activeTrips:     number
}

export function MetricsBar({
  totalVehicles,
  activeVehicles,
  delayedVehicles,
  totalStudents,
  boardedStudents,
  activeTrips,
}: MetricsBarProps) {
  const onTimeVehicles = activeVehicles - delayedVehicles
  const onTimeRate = activeVehicles > 0 ? Math.round((onTimeVehicles / activeVehicles) * 100) : 100
  const boardedRate = totalStudents > 0 ? Math.round((boardedStudents / totalStudents) * 100) : 0

  const metrics = [
    {
      label:   'Véhicules actifs',
      value:   `${activeVehicles}/${totalVehicles}`,
      sub:     `${onTimeVehicles} à l'heure`,
      color:   'text-success',
      bgColor: 'bg-green-50',
      icon:    <BusIcon />,
    },
    {
      label:   'En retard',
      value:   delayedVehicles.toString(),
      sub:     delayedVehicles === 0 ? 'Aucun retard' : `sur ${activeVehicles} actifs`,
      color:   delayedVehicles > 0 ? 'text-warning' : 'text-success',
      bgColor: delayedVehicles > 0 ? 'bg-amber-50' : 'bg-green-50',
      icon:    <ClockIcon />,
    },
    {
      label:   'Élèves à bord',
      value:   `${boardedStudents}/${totalStudents}`,
      sub:     `${boardedRate}% embarqués`,
      color:   'text-navy-900',
      bgColor: 'bg-blue-50',
      icon:    <UsersIcon />,
    },
    {
      label:   'Trajets actifs',
      value:   activeTrips.toString(),
      sub:     `aujourd'hui`,
      color:   'text-navy-900',
      bgColor: 'bg-navy-50',
      icon:    <RouteIcon />,
    },
    {
      label:   'Ponctualité',
      value:   `${onTimeRate}%`,
      sub:     'ce matin',
      color:   onTimeRate >= 90 ? 'text-success' : onTimeRate >= 75 ? 'text-warning' : 'text-danger',
      bgColor: onTimeRate >= 90 ? 'bg-green-50' : onTimeRate >= 75 ? 'bg-amber-50' : 'bg-red-50',
      icon:    <CheckIcon />,
    },
  ]

  return (
    <div className="bg-white border-b border-navy-100 px-6 py-2 flex gap-4 overflow-x-auto scrollbar-thin shrink-0">
      {metrics.map((m, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-lg shrink-0 min-w-[160px]',
            m.bgColor
          )}
        >
          <span className={cn('opacity-60', m.color)}>{m.icon}</span>
          <div>
            <p className={cn('font-poppins font-semibold text-xl leading-none', m.color)}>
              {m.value}
            </p>
            <p className="text-xs text-navy-500 mt-0.5">{m.label}</p>
            <p className="text-xs text-navy-400">{m.sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const BusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 8C8 10 5.9 16.17 3.82 20.83L5.71 22l1-2.3A4.49 4.49 0 008 20c4 0 4-2 8-2s4 2 8 2l1-2C23 14 19 6 17 8zm-8 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm8 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)

const RouteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
