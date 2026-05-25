import type { GpsLocation, Stop, TripStop } from '@voyo/types'

// ============================================================
// VOYO — Moteur de calcul ETA
// ============================================================

const AVERAGE_SPEED_KMH = 30     // Vitesse moyenne en milieu urbain
const STOP_DWELL_SECONDS = 90    // Temps d'arrêt moyen par arrêt (1m30)
const BOARDING_SECONDS   = 15    // Secondes supplémentaires par élève

// Formule Haversine — distance en km entre deux points GPS
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371 // Rayon Terre en km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const toRad = (deg: number) => deg * (Math.PI / 180)

// ============================================================
// Calculer l'ETA pour un arrêt donné
// ============================================================

interface ETAInput {
  currentLat: number
  currentLng: number
  currentSpeed: number | null // km/h
  targetStop: { lat: number; lng: number }
  remainingStops: Array<{
    lat: number
    lng: number
    studentCount: number
  }>
  stopIndex: number // index du stop cible dans remainingStops
}

export function calculateETA(input: ETAInput): Date {
  const {
    currentLat, currentLng, currentSpeed,
    targetStop, remainingStops, stopIndex,
  } = input

  const speedKmh = currentSpeed && currentSpeed > 2
    ? currentSpeed
    : AVERAGE_SPEED_KMH

  let totalSeconds = 0

  // Temps jusqu'aux stops intermédiaires
  let prevLat = currentLat
  let prevLng = currentLng

  for (let i = 0; i <= stopIndex; i++) {
    const stop = remainingStops[i]
    const distKm = haversineKm(prevLat, prevLng, stop.lat, stop.lng)
    const travelSeconds = (distKm / speedKmh) * 3600

    totalSeconds += travelSeconds

    // Temps d'arrêt (sauf le dernier)
    if (i < stopIndex) {
      totalSeconds += STOP_DWELL_SECONDS
      totalSeconds += stop.studentCount * BOARDING_SECONDS
    }

    prevLat = stop.lat
    prevLng = stop.lng
  }

  return new Date(Date.now() + totalSeconds * 1000)
}

// ============================================================
// Calculer l'ETA pour l'arrivée finale à l'école
// ============================================================

export function calculateSchoolETA(input: {
  currentLat: number
  currentLng: number
  currentSpeed: number | null
  remainingStops: Array<{
    lat: number
    lng: number
    studentCount: number
  }>
  schoolLat: number
  schoolLng: number
}): Date {
  const { currentLat, currentLng, currentSpeed, remainingStops, schoolLat, schoolLng } = input
  const speedKmh = currentSpeed && currentSpeed > 2 ? currentSpeed : AVERAGE_SPEED_KMH

  let totalSeconds = 0
  let prevLat = currentLat
  let prevLng = currentLng

  // Tous les arrêts restants
  for (const stop of remainingStops) {
    const distKm = haversineKm(prevLat, prevLng, stop.lat, stop.lng)
    totalSeconds += (distKm / speedKmh) * 3600
    totalSeconds += STOP_DWELL_SECONDS
    totalSeconds += stop.studentCount * BOARDING_SECONDS
    prevLat = stop.lat
    prevLng = stop.lng
  }

  // Distance école
  const distToSchool = haversineKm(prevLat, prevLng, schoolLat, schoolLng)
  totalSeconds += (distToSchool / speedKmh) * 3600

  return new Date(Date.now() + totalSeconds * 1000)
}

// ============================================================
// Détecter si le bus est à l'intérieur d'une géofence
// ============================================================

export function isInsideGeofence(
  busLat: number, busLng: number,
  centerLat: number, centerLng: number,
  radiusMeters: number
): boolean {
  const distKm = haversineKm(busLat, busLng, centerLat, centerLng)
  return distKm * 1000 <= radiusMeters
}

// ============================================================
// Calculer le pourcentage de progression d'un trajet
// ============================================================

export function calculateTripProgress(
  completedStops: number,
  totalStops: number
): number {
  if (totalStops === 0) return 0
  return Math.round((completedStops / totalStops) * 100)
}

// ============================================================
// Calculer le retard en minutes
// ============================================================

export function calculateDelay(
  scheduledTime: Date,
  actualTime: Date
): number {
  const diffMs = actualTime.getTime() - scheduledTime.getTime()
  return Math.max(0, Math.round(diffMs / 60000))
}

// ============================================================
// Formater l'ETA en texte français
// ============================================================

export function formatETA(eta: Date): string {
  const now = new Date()
  const diffMs = eta.getTime() - now.getTime()
  const diffMin = Math.round(diffMs / 60000)

  if (diffMin < 0) return 'Arrivé'
  if (diffMin === 0) return 'Maintenant'
  if (diffMin === 1) return 'Dans 1 minute'
  if (diffMin < 60) return `Dans ${diffMin} minutes`

  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  if (m === 0) return `Dans ${h}h`
  return `Dans ${h}h${String(m).padStart(2, '0')}`
}

// ============================================================
// Détecter approche d'un arrêt (notification préventive)
// ============================================================

export function shouldSendApproachNotification(
  busLat: number, busLng: number,
  stopLat: number, stopLng: number,
  thresholdMeters: number = 500
): boolean {
  const distKm = haversineKm(busLat, busLng, stopLat, stopLng)
  return distKm * 1000 <= thresholdMeters
}
