'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Notification } from '@voyo/types'

interface AlertsPanelProps {
  alerts: Notification[]
}

const ALERT_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  emergency:   { icon: '🚨', color: 'text-danger',  bg: 'bg-red-50'   },
  delay_alert: { icon: '⏰', color: 'text-warning', bg: 'bg-amber-50' },
  route_change:{ icon: '🔄', color: 'text-blue-500',bg: 'bg-blue-50'  },
  default:     { icon: '📢', color: 'text-navy-600', bg: 'bg-navy-50' },
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = alerts.filter(a => !dismissed.has(a.id))

  return (
    <div className="border-t border-navy-100">
      {/* En-tête collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-navy-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Alertes
          </span>
          {visible.length > 0 && (
            <span className="flex items-center justify-center w-4 h-4 bg-danger text-white text-xs font-bold rounded-full">
              {visible.length}
            </span>
          )}
        </div>
        <ChevronIcon direction={expanded ? 'up' : 'down'} />
      </button>

      {expanded && (
        <div className="max-h-48 overflow-y-auto scrollbar-thin">
          {visible.length === 0 ? (
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-navy-400">Aucune alerte active</p>
            </div>
          ) : (
            visible.slice(0, 8).map(alert => {
              const config = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.default
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'flex items-start gap-2.5 px-4 py-2.5 border-b border-navy-50 last:border-0',
                    config.bg
                  )}
                >
                  <span className="text-sm shrink-0 mt-0.5">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold truncate', config.color)}>
                      {alert.title}
                    </p>
                    <p className="text-xs text-navy-500 mt-0.5 truncate-2">
                      {alert.body}
                    </p>
                    <p className="text-xs text-navy-300 mt-0.5">
                      {formatDistanceToNow(new Date(alert.created_at), { locale: fr, addSuffix: true })}
                    </p>
                  </div>
                  <button
                    onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
                    className="shrink-0 p-0.5 hover:bg-navy-200 rounded transition-colors"
                    aria-label="Fermer"
                  >
                    <CloseIcon />
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

const ChevronIcon = ({ direction }: { direction: 'up' | 'down' }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy-400">
    {direction === 'up' ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
  </svg>
)

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy-400">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)
