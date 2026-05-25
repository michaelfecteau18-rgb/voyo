'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TRIP_ID = '71111111-1111-1111-1111-111111111111'
const VEHICLE_ID = '31111111-1111-1111-1111-111111111111'
const ORG_ID = '11111111-1111-1111-1111-111111111111'

export default function DriverPage() {
  const [status, setStatus] = useState<'idle' | 'active' | 'stopped'>('idle')
  const [lastPos, setLastPos] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')
  const [count, setCount] = useState(0)
  const watchRef = useRef<number | null>(null)

  const startTrip = () => {
    setError('')
    if (!navigator.geolocation) {
      setError('GPS non disponible sur cet appareil')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await sendPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.heading)
        setStatus('active')

        watchRef.current = navigator.geolocation.watchPosition(
          async (p) => {
            await sendPosition(p.coords.latitude, p.coords.longitude, p.coords.speed, p.coords.heading)
            setLastPos({ lat: p.coords.latitude, lng: p.coords.longitude })
            setCount(c => c + 1)
          },
          (err) => setError('Erreur GPS: ' + err.message),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        )
      },
      (err) => setError('Impossible d\'accéder au GPS: ' + err.message),
      { enableHighAccuracy: true }
    )
  }

  const stopTrip = () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    setStatus('stopped')
  }

  const sendPosition = async (lat: number, lng: number, speed: number | null, heading: number | null) => {
    await supabase.from('gps_positions').insert({
      trip_id: TRIP_ID,
      vehicle_id: VEHICLE_ID,
      lat,
      lng,
      speed_kmh: speed ? speed * 3.6 : null,
      heading: heading ?? null,
    })
  }

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current)
      }
    }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#072B57', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'sans-serif' }}>
      
      {/* Logo */}
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', background: '#16C7B8', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <span style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>V</span>
        </div>
        <h1 style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: 0 }}>VOYO</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '4px 0 0' }}>Application chauffeur</p>
      </div>

      {/* Card principale */}
      <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '360px' }}>
        
        {/* Statut */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 16px',
            background: status === 'active' ? '#E8F8F1' : status === 'stopped' ? '#F0F4F8' : '#E0F9F7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px'
          }}>
            {status === 'active' ? '🚌' : status === 'stopped' ? '⏹️' : '🚌'}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#072B57', margin: '0 0 4px' }}>
            {status === 'idle' ? 'Prêt à démarrer' : status === 'active' ? 'Trajet en cours' : 'Trajet terminé'}
          </h2>
          <p style={{ fontSize: '14px', color: '#9BB0CE', margin: 0 }}>
            {status === 'active' ? `${count} positions envoyées` : 'Autobus 01 — Route 01'}
          </p>
        </div>

        {/* Position actuelle */}
        {lastPos && (
          <div style={{ background: '#F5F7FA', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', color: '#9BB0CE', margin: '0 0 4px' }}>Position actuelle</p>
            <p style={{ fontSize: '13px', color: '#072B57', fontWeight: '600', margin: 0 }}>
              {lastPos.lat.toFixed(5)}, {lastPos.lng.toFixed(5)}
            </p>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div style={{ background: '#FFF0EF', border: '1px solid #FFD0CE', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px' }}>
            <p style={{ fontSize: '13px', color: '#FF3B30', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Boutons */}
        {status === 'idle' && (
          <button
            onClick={startTrip}
            style={{ width: '100%', padding: '16px', background: '#16C7B8', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: '700', cursor: 'pointer' }}
          >
            Démarrer le trajet
          </button>
        )}

        {status === 'active' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#34C759', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '14px', color: '#34C759', fontWeight: '600' }}>GPS actif — En direct</span>
            </div>
            <button
              onClick={stopTrip}
              style={{ width: '100%', padding: '16px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: '700', cursor: 'pointer' }}
            >
              Terminer le trajet
            </button>
          </>
        )}

        {status === 'stopped' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '40px', marginBottom: '8px' }}>✅</p>
            <p style={{ color: '#34C759', fontWeight: '600', fontSize: '16px' }}>Trajet terminé avec succès</p>
            <button
              onClick={() => { setStatus('idle'); setCount(0); setLastPos(null) }}
              style={{ marginTop: '16px', padding: '12px 24px', background: '#072B57', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
            >
              Nouveau trajet
            </button>
          </div>
        )}
      </div>

      {/* Note iOS */}
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '24px', textAlign: 'center', maxWidth: '300px' }}>
        Sur iPhone, autorisez l'accès à la localisation quand demandé
      </p>
    </div>
  )
}