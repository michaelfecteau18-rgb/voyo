'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DriversPage() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('drivers')
      .select('*, profile:profiles(first_name, last_name, phone, avatar_url)')
      .eq('is_active', true)
      .order('created_at')
      .then(({ data }) => {
        if (data) setDrivers(data)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'sans-serif', fontSize: '24px', fontWeight: '700', color: '#072B57', margin: 0 }}>Chauffeurs</h1>
        <p style={{ color: '#9BB0CE', fontSize: '14px', marginTop: '4px' }}>{drivers.length} chauffeurs actifs</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9BB0CE' }}>Chargement...</div>
      ) : drivers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '12px', border: '1px solid #E8EDF4' }}>
          <p style={{ fontSize: '40px', margin: '0 0 16px' }}>🚌</p>
          <p style={{ color: '#072B57', fontWeight: '600', fontSize: '16px', margin: '0 0 8px' }}>Aucun chauffeur enregistré</p>
          <p style={{ color: '#9BB0CE', fontSize: '14px', margin: 0 }}>Les chauffeurs apparaîtront ici une fois ajoutés.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {drivers.map(driver => (
            <div key={driver.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E8EDF4', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#072B57', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                  {driver.profile?.first_name?.[0]}{driver.profile?.last_name?.[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: '#072B57' }}>
                    {driver.profile?.first_name} {driver.profile?.last_name}
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#9BB0CE' }}>{driver.profile?.phone ?? '—'}</p>
                </div>
                <span style={{ marginLeft: 'auto', background: '#E8F8F1', color: '#34C759', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Actif</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #F5F7FA', paddingTop: '12px' }}>
                {[
                  { label: 'Permis', value: driver.license_number },
                  { label: 'Classe', value: driver.license_class },
                  { label: 'Expiration', value: driver.license_expiry },
                  { label: 'Employé #', value: driver.employee_number ?? '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#9BB0CE' }}>{row.label}</span>
                    <span style={{ color: '#072B57', fontWeight: '500' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}