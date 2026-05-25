'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function RoutesPage() {
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('routes')
      .select('*, school:schools(name), stops:stops(count)')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setRoutes(data)
        setLoading(false)
      })
  }, [])

  const dayLabels = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'sans-serif', fontSize: '24px', fontWeight: '700', color: '#072B57', margin: 0 }}>Itinéraires</h1>
        <p style={{ color: '#9BB0CE', fontSize: '14px', marginTop: '4px' }}>{routes.length} routes actives</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9BB0CE' }}>Chargement...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {routes.map(route => (
            <div key={route.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E8EDF4', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '4px', height: '60px', background: route.color ?? '#16C7B8', borderRadius: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: '#072B57' }}>{route.name}</h3>
                <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#9BB0CE' }}>{route.school?.name ?? '—'}</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(route.recurring_days ?? []).map((d: number) => (
                    <span key={d} style={{ background: '#E0F9F7', color: '#16C7B8', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                      {dayLabels[d]}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '24px', textAlign: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#072B57' }}>{route.total_stops}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#9BB0CE' }}>Arrêts</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#072B57' }}>{route.scheduled_start ?? '—'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#9BB0CE' }}>Départ</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#072B57' }}>{route.estimated_duration ?? '—'} min</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#9BB0CE' }}>Durée</p>
                </div>
              </div>
              <span style={{ background: '#E8F8F1', color: '#34C759', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                {route.route_type === 'morning' ? 'Matin' : 'Après-midi'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}