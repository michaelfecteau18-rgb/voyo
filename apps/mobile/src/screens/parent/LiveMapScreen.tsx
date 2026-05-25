import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker, Polyline, Circle, PROVIDER_DEFAULT } from 'react-native-maps'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useRealtimeTrip } from '@/hooks/useRealtimeTrip'
import { formatETA } from '@voyo/utils'

interface LiveMapProps {
  navigation: any
  route: { params: { tripId: string; studentId: string } }
}

export default function LiveMapScreen({ navigation, route }: LiveMapProps) {
  const { tripId, studentId } = route.params
  const mapRef = useRef<MapView>(null)

  const [busPosition, setBusPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [student, setStudent] = useState<any>(null)
  const [trip, setTrip]   = useState<any>(null)
  const [stops, setStops] = useState<any[]>([])
  const [eta, setEta]     = useState<string>('')
  const [delay, setDelay] = useState(0)
  const [status, setStatus] = useState('')

  // Pulse animation pour le marqueur bus
  const pulseAnim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  useEffect(() => { loadData() }, [tripId])

  // Écouter les mises à jour GPS en temps réel
  useRealtimeTrip(
    [tripId],
    (id, update) => {
      if (update.estimated_end) setEta(formatETA(new Date(update.estimated_end)))
      if (update.delay_minutes !== undefined) setDelay(update.delay_minutes ?? 0)
      if (update.status) setStatus(update.status)
    },
    (gps) => {
      setBusPosition({ lat: gps.lat, lng: gps.lng })
      // Re-centrer la carte sur le bus
      mapRef.current?.animateToRegion({
        latitude: gps.lat,
        longitude: gps.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 800)
    }
  )

  const loadData = async () => {
    // Élève
    const { data: s } = await supabase
      .from('students')
      .select('*, school:schools(name, location)')
      .eq('id', studentId)
      .single()
    if (s) setStudent(s)

    // Trajet avec arrêts
    const { data: t } = await supabase
      .from('trips')
      .select(`
        *,
        vehicle:vehicles(name),
        driver:drivers(profile:profiles(first_name, last_name))
      `)
      .eq('id', tripId)
      .single()
    if (t) {
      setTrip(t)
      setDelay(t.delay_minutes ?? 0)
      setStatus(t.status)
      if (t.estimated_end) setEta(formatETA(new Date(t.estimated_end)))
    }

    // Arrêts
    const { data: ts } = await supabase
      .from('trip_stops')
      .select('*, stop:stops(name, location, sequence_order)')
      .eq('trip_id', tripId)
      .order('sequence_order')
    if (ts) setStops(ts)

    // Dernière position GPS
    const { data: gps } = await supabase
      .from('gps_locations')
      .select('lat, lng')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()
    if (gps) setBusPosition({ lat: gps.lat, lng: gps.lng })
  }

  const isDelayed = delay > 5

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {student?.first_name} {student?.last_name}
          </Text>
          <Text style={styles.headerSub}>
            {trip?.vehicle?.name ?? 'En route'}
          </Text>
        </View>
        <View style={[styles.liveIndicator, isDelayed && styles.liveIndicatorDelay]}>
          <View style={[styles.liveDot, isDelayed && styles.liveDotDelay]} />
          <Text style={[styles.liveText, isDelayed && styles.liveTextDelay]}>
            {isDelayed ? `+${delay}min` : 'En direct'}
          </Text>
        </View>
      </View>

      {/* Carte */}
      <View style={styles.mapContainer}>
        {busPosition ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: busPosition.lat,
              longitude: busPosition.lng,
              latitudeDelta: 0.03,
              longitudeDelta: 0.03,
            }}
            mapType="mutedStandard"
            showsUserLocation={false}
            showsCompass={false}
          >
            {/* Marqueur bus animé */}
            <Marker
              coordinate={{ latitude: busPosition.lat, longitude: busPosition.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.busMarkerContainer}>
                <Animated.View
                  style={[styles.busPulse, { transform: [{ scale: pulseAnim }] }]}
                />
                <View style={[styles.busMarker, isDelayed && styles.busMarkerDelay]}>
                  <Text style={styles.busEmoji}>🚌</Text>
                </View>
              </View>
            </Marker>

            {/* Arrêts */}
            {stops.map((ts, i) => {
              const loc = ts.stop?.location?.coordinates
              if (!loc) return null
              const [lng, lat] = loc
              const isCompleted = ts.is_completed
              const isCurrent = !ts.is_completed &&
                stops.filter(s => !s.is_completed)[0]?.id === ts.id
              return (
                <React.Fragment key={ts.id}>
                  <Marker
                    coordinate={{ latitude: lat, longitude: lng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={[
                      styles.stopMarker,
                      isCompleted && styles.stopMarkerDone,
                      isCurrent && styles.stopMarkerCurrent,
                    ]}>
                      <Text style={[
                        styles.stopNum,
                        isCompleted && { color: '#9BB0CE' },
                        isCurrent && { color: '#FFFFFF' },
                      ]}>
                        {i + 1}
                      </Text>
                    </View>
                  </Marker>
                  {isCurrent && (
                    <Circle
                      center={{ latitude: lat, longitude: lng }}
                      radius={50}
                      fillColor="rgba(22,199,184,0.1)"
                      strokeColor="rgba(22,199,184,0.3)"
                      strokeWidth={1}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </MapView>
        ) : (
          <View style={styles.mapLoading}>
            <Text style={styles.mapLoadingText}>Localisation du bus…</Text>
          </View>
        )}
      </View>

      {/* Panneau infos bas */}
      <View style={styles.infoPanel}>
        {/* ETA */}
        <View style={styles.etaRow}>
          <View>
            <Text style={styles.etaLabel}>Arrivée estimée</Text>
            <Text style={[styles.etaValue, isDelayed && { color: '#FF9500' }]}>
              {eta || 'Calcul en cours…'}
            </Text>
          </View>
          {isDelayed && (
            <View style={styles.delayBadge}>
              <Text style={styles.delayText}>+{delay} min</Text>
            </View>
          )}
        </View>

        {/* Statut élève */}
        <View style={styles.statusRow}>
          <StatusItem
            icon="👤"
            label="Statut élève"
            value={getAttendanceLabel(status)}
          />
          <StatusItem
            icon="🚌"
            label="Chauffeur"
            value={trip?.driver?.profile
              ? `${trip.driver.profile.first_name} ${trip.driver.profile.last_name}`
              : '—'
            }
          />
        </View>

        {/* Barre de progression arrêts */}
        <View style={styles.stopsProgress}>
          <Text style={styles.stopsLabel}>
            {stops.filter(s => s.is_completed).length}/{stops.length} arrêts complétés
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: stops.length > 0
                ? `${(stops.filter(s => s.is_completed).length / stops.length) * 100}%`
                : '0%'
            }]} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

function StatusItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.statusItem}>
      <Text style={styles.statusIcon}>{icon}</Text>
      <View>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusValue}>{value}</Text>
      </View>
    </View>
  )
}

function getAttendanceLabel(status: string) {
  const map: Record<string, string> = {
    boarded: 'À bord ✓',
    absent: 'Absent',
    dropped_off: 'Déposé ✓',
    present_at_school: 'À l\'école ✓',
    en_route: 'Bus en route',
    scheduled: 'Planifié',
  }
  return map[status] ?? status
}

const BackIcon = () => null // Utiliser @expo/vector-icons en prod

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#072B57' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerTitle: {
    fontSize: 17, fontWeight: '600', color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
  },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular' },
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  liveIndicatorDelay: { backgroundColor: 'rgba(255,149,0,0.15)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  liveDotDelay: { backgroundColor: '#FF9500' },
  liveText: { fontSize: 12, fontWeight: '600', color: '#34C759', fontFamily: 'Inter_600SemiBold' },
  liveTextDelay: { color: '#FF9500' },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  mapLoading: { flex: 1, backgroundColor: '#E8EDF4', alignItems: 'center', justifyContent: 'center' },
  mapLoadingText: { fontSize: 15, color: '#5578AA', fontFamily: 'Inter_400Regular' },
  busMarkerContainer: { alignItems: 'center', justifyContent: 'center' },
  busPulse: {
    position: 'absolute',
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(22,199,184,0.2)',
  },
  busMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#16C7B8',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  busMarkerDelay: { borderColor: '#FF9500' },
  busEmoji: { fontSize: 20 },
  stopMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#C4D0E3',
  },
  stopMarkerDone: { borderColor: '#E8EDF4', backgroundColor: '#F5F7FA' },
  stopMarkerCurrent: { borderColor: '#16C7B8', backgroundColor: '#16C7B8' },
  stopNum: { fontSize: 11, fontWeight: '700', color: '#5578AA', fontFamily: 'Poppins_700Bold' },
  infoPanel: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#072B57', shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  etaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  etaLabel: { fontSize: 12, color: '#9BB0CE', fontFamily: 'Inter_400Regular' },
  etaValue: {
    fontSize: 28, fontWeight: '700', color: '#072B57',
    fontFamily: 'Poppins_700Bold', marginTop: 2,
  },
  delayBadge: {
    backgroundColor: '#FFF5E6', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  delayText: { fontSize: 14, fontWeight: '700', color: '#FF9500', fontFamily: 'Poppins_700Bold' },
  statusRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  statusItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusIcon: { fontSize: 22 },
  statusLabel: { fontSize: 11, color: '#9BB0CE', fontFamily: 'Inter_400Regular' },
  statusValue: { fontSize: 13, fontWeight: '600', color: '#072B57', fontFamily: 'Inter_600SemiBold', marginTop: 1 },
  stopsProgress: { gap: 6 },
  stopsLabel: { fontSize: 12, color: '#9BB0CE', fontFamily: 'Inter_400Regular' },
  progressTrack: { height: 4, backgroundColor: '#F0F4F8', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#16C7B8', borderRadius: 2 },
})
