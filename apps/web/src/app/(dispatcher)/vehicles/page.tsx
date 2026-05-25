'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('vehicles').select('*').order('name').then(({ data }) => {
      if (data) setVehicles(data)
      setLoading(false)
    })
  }, [])

  const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
    active:        { label: 'Actif',          color: '#34C759', bg: '#E8F8F1' },
    inactive:      { label: 'Inactif',         color: '#9BB0CE', bg: '#F0F4F8' },
    maintenance:   { label: 'Maintenance',     color: '#FF9500', bg: '#FFF5E6' },
    out_of_service:{ label: 'Hors service',    color: '#FF3B30', bg: '#FFF0EF' },
  }

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'sans-serif', fontSize: '24px', fontWeight: '700', color: '#072B57', margin: 0 }}>Véhicules</h1>
        <p style={{ color: '#9BB0CE', fontSize: '14px', marginTop: '4px' }}>{vehicles.length} véhicules enregistrés</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9BB0CE' }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {vehicles.map(v => {
            const s = statusLabel[v.status] ?? statusLabel.inactive
            return (
              <div key={v.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E8EDF4', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#E0F9F7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    🚌
                  </div>
                  <span style={{ background: s.bg, color: s.color, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{s.label}</span>
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: '#072B57' }}>{v.name}</h3>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#9BB0CE' }}>{v.plate_number}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { label: 'Marque', value: `${v.make ?? '—'} ${v.model ?? ''}` },
                    { label: 'Année', value: v.year ?? '—' },
                    { label: 'Capacité', value: `${v.capacity} places` },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#9BB0CE' }}>{row.label}</span>
                      <span style={{ color: '#072B57', fontWeight: '500' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}