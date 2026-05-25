'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createBrowserClient } from '@supabase/ssr'

type ActiveVehicleStatus = any
type Trip = any

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface FleetMapProps {
  vehicles: ActiveVehicleStatus[]
  trips: Trip[]
  selectedVehicleId: string | null
  onVehicleSelect: (id: string) => void
}

const vehicleColor = (v: ActiveVehicleStatus) => {
  if (v.trip_status === 'emergency') return '#FF3B30'
  if ((v.delay_minutes ?? 0) > 5) return '#FF9500'
  if (v.trip_status === 'en_route') return '#34C759'
  return '#9BB0CE'
}

export function FleetMap({ vehicles, trips, selectedVehicleId, onVehicleSelect }: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (!mapContainerRef.current) return
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-72.7322, 45.3956],
      zoom: 12,
      attributionControl: false,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('load', () => {
      setMapLoaded(true)
      map.setPaintProperty('water', 'fill-color', '#E8F4FD')
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'route-lines', type: 'line', source: 'routes', paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.7 }, layout: { 'line-join': 'round', 'line-cap': 'round' } })
    })
    mapRef.current = map
    return () => map.remove()
  }, [])

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    console.log('Connecting to Realtime...')
    const channel = sb
      .channel('gps-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gps_positions' },
        (payload: any) => {
          console.log('GPS update:', payload.new)
          const { vehicle_id, lat, lng } = payload.new
          const marker = markersRef.current.get(vehicle_id)
          if (marker) {
            marker.setLngLat([lng, lat])
            console.log('Marker moved to:', lat, lng)
          } else {
            console.log('No marker for vehicle:', vehicle_id)
          }
        }
      )
      .subscribe((status: any) => {
        console.log('Realtime status:', status)
      })
    return () => { sb.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current
    vehicles.forEach(vehicle => {
      if (!vehicle.lat || !vehicle.lng) return
      const color = vehicleColor(vehicle)
      const isSelected = vehicle.vehicle_id === selectedVehicleId
      if (markersRef.current.has(vehicle.vehicle_id)) {
        const marker = markersRef.current.get(vehicle.vehicle_id)!
        marker.setLngLat([vehicle.lng, vehicle.lat])
        updateMarkerElement(marker.getElement(), vehicle, color, isSelected)
      } else {
        const el = createMarkerElement(vehicle, color, isSelected)
        el.addEventListener('click', () => onVehicleSelect(vehicle.vehicle_id))
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([vehicle.lng, vehicle.lat])
          .addTo(map)
        markersRef.current.set(vehicle.vehicle_id, marker)
      }
    })
    markersRef.current.forEach((marker, id) => {
      if (!vehicles.find((v: any) => v.vehicle_id === id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })
  }, [vehicles, mapLoaded, selectedVehicleId, onVehicleSelect])

  useEffect(() => {
    if (!selectedVehicleId || !mapRef.current) return
    const vehicle = vehicles.find((v: any) => v.vehicle_id === selectedVehicleId)
    if (!vehicle?.lat || !vehicle?.lng) return
    mapRef.current.flyTo({ center: [vehicle.lng, vehicle.lat], zoom: 14, duration: 800 })
  }, [selectedVehicleId, vehicles])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {!mapLoaded && (
        <div style={{ position: 'absolute', inset: 0, background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', border: '2px solid #16C7B8', borderTopColor: 'transparent', borderRadius: '50%' }} />
          <p style={{ color: '#9BB0CE', fontSize: '14px' }}>Chargement de la carte…</p>
        </div>
      )}
    </div>
  )
}

function createMarkerElement(vehicle: any, color: string, isSelected: boolean): HTMLElement {
  const el = document.createElement('div')
  el.style.cursor = 'pointer'
  updateMarkerElement(el, vehicle, color, isSelected)
  return el
}

function updateMarkerElement(el: HTMLElement, vehicle: any, color: string, isSelected: boolean) {
  const delay = vehicle.delay_minutes ?? 0
  const size = isSelected ? 52 : 44
  el.innerHTML = `
    <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      <div style="width:${size - 4}px;height:${size - 4}px;border-radius:50%;background:white;border:${isSelected ? 3 : 2}px solid ${color};display:flex;align-items:center;justify-content:center;flex-direction:column;box-shadow:0 2px 8px rgba(7,43,87,0.15);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${color}">
          <path d="M17 8C8 10 5.9 16.17 3.82 20.83L5.71 22l1-2.3A4.49 4.49 0 008 20c4 0 4-2 8-2s4 2 8 2l1-2C23 14 19 6 17 8zm-8 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm8 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
        </svg>
        ${delay > 0 ? `<span style="font-size:8px;font-weight:700;color:${delay > 10 ? '#FF3B30' : '#FF9500'};line-height:1;margin-top:1px;">+${delay}m</span>` : ''}
      </div>
      <div style="position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);background:${isSelected ? '#072B57' : 'rgba(255,255,255,0.95)'};color:${isSelected ? 'white' : '#072B57'};font-size:10px;font-weight:600;padding:2px 6px;border-radius:20px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.12);border:1px solid ${isSelected ? '#072B57' : '#E8EDF4'};">
        ${vehicle.vehicle_name}
      </div>
    </div>
  `
}