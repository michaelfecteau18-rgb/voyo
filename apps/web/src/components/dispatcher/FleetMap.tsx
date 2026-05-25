'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
type ActiveVehicleStatus = any
type Trip = any

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface FleetMapProps {
  vehicles: ActiveVehicleStatus[]
  trips: Trip[]
  selectedVehicleId: string | null
  onVehicleSelect: (id: string) => void
}

// Couleur selon statut
const vehicleColor = (v: ActiveVehicleStatus) => {
  if (v.trip_status === 'emergency') return '#FF3B30'
  if ((v.delay_minutes ?? 0) > 5)   return '#FF9500'
  if (v.trip_status === 'en_route')  return '#34C759'
  return '#9BB0CE'
}

export function FleetMap({ vehicles, trips, selectedVehicleId, onVehicleSelect }: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const [mapLoaded, setMapLoaded] = useState(false)

  // Init carte
  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-73.5674, 45.5017], // Montréal par défaut
      zoom: 11,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load', () => {
      setMapLoaded(true)

      // Style personnalisé VOYO
      map.setPaintProperty('water', 'fill-color', '#E8F4FD')
      map.setPaintProperty('road-secondary-tertiary', 'line-color', '#E8EDF4')
      map.setPaintProperty('road-street', 'line-color', '#F0F4F8')

      // Source pour les itinéraires
      map.addSource('routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.7,
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
      })

      // Layer zones école
      map.addSource('school-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'school-zones-fill',
        type: 'circle',
        source: 'school-zones',
        paint: {
          'circle-radius': 20,
          'circle-color': '#072B57',
          'circle-opacity': 0.08,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#072B57',
          'circle-stroke-opacity': 0.2,
        },
      })
    })

    mapRef.current = map
    return () => map.remove()
  }, [])

  // Mettre à jour les marqueurs véhicules
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current

    vehicles.forEach(vehicle => {
      if (!vehicle.lat || !vehicle.lng) return

      const color = vehicleColor(vehicle)
      const isSelected = vehicle.vehicle_id === selectedVehicleId

      if (markersRef.current.has(vehicle.vehicle_id)) {
        // Mettre à jour position
        const marker = markersRef.current.get(vehicle.vehicle_id)!
        marker.setLngLat([vehicle.lng, vehicle.lat])
        // Mettre à jour élément
        const el = marker.getElement()
        updateMarkerElement(el, vehicle, color, isSelected)
      } else {
        // Créer marqueur
        const el = createMarkerElement(vehicle, color, isSelected)
        el.addEventListener('click', () => onVehicleSelect(vehicle.vehicle_id))

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([vehicle.lng, vehicle.lat])
          .addTo(map)

        markersRef.current.set(vehicle.vehicle_id, marker)
      }
    })

    // Retirer marqueurs véhicules supprimés
    markersRef.current.forEach((marker, id) => {
      if (!vehicles.find(v => v.vehicle_id === id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })
  }, [vehicles, mapLoaded, selectedVehicleId, onVehicleSelect])

  // Centrer sur véhicule sélectionné
  useEffect(() => {
    if (!selectedVehicleId || !mapRef.current) return
    const vehicle = vehicles.find(v => v.vehicle_id === selectedVehicleId)
    if (!vehicle?.lat || !vehicle?.lng) return

    mapRef.current.flyTo({
      center: [vehicle.lng, vehicle.lat],
      zoom: 14,
      duration: 800,
      easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    })
  }, [selectedVehicleId, vehicles])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Overlay chargement */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-surface flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-navy-400">Chargement de la carte…</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Créer l'élément DOM du marqueur
function createMarkerElement(vehicle: ActiveVehicleStatus, color: string, isSelected: boolean): HTMLElement {
  const el = document.createElement('div')
  el.style.cursor = 'pointer'
  updateMarkerElement(el, vehicle, color, isSelected)
  return el
}

function updateMarkerElement(el: HTMLElement, vehicle: ActiveVehicleStatus, color: string, isSelected: boolean) {
  const delay = vehicle.delay_minutes ?? 0
  const size = isSelected ? 52 : 44

  el.innerHTML = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    ">
      ${isSelected || vehicle.trip_status === 'en_route' ? `
        <div style="
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: ${color};
          opacity: 0.15;
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "/>
      ` : ''}
      <div style="
        width: ${size - 4}px;
        height: ${size - 4}px;
        border-radius: 50%;
        background: white;
        border: ${isSelected ? 3 : 2}px solid ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        box-shadow: 0 2px 8px rgba(7,43,87,0.15);
        transition: all 0.2s ease;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${color}">
          <path d="M17 8C8 10 5.9 16.17 3.82 20.83L5.71 22l1-2.3A4.49 4.49 0 008 20c4 0 4-2 8-2s4 2 8 2l1-2C23 14 19 6 17 8zm-8 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm8 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
        </svg>
        ${delay > 0 ? `
          <span style="
            font-size: 8px;
            font-weight: 700;
            color: ${delay > 10 ? '#FF3B30' : '#FF9500'};
            line-height: 1;
            margin-top: 1px;
          ">+${delay}m</span>
        ` : ''}
      </div>

      <!-- Étiquette nom -->
      <div style="
        position: absolute;
        bottom: -22px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isSelected ? '#072B57' : 'rgba(255,255,255,0.95)'};
        color: ${isSelected ? 'white' : '#072B57'};
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 20px;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.12);
        border: 1px solid ${isSelected ? '#072B57' : '#E8EDF4'};
      ">
        ${vehicle.vehicle_name}
      </div>
    </div>
  `
}
