import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, Alert, Vibration, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import type { Student, Stop, Trip } from '@voyo/types'

// Interface chauffeur: GRAND, SIMPLE, RAPIDE
// Conçue pour un usage en conduisant — boutons larges, texte gros

type ScreenState = 'pre_trip' | 'driving' | 'at_stop' | 'completed'

interface ActiveStop extends Stop {
  students: Student[]
  is_completed: boolean
}

export default function DriverRouteScreen({ navigation, route }: any) {
  const { tripId } = route.params
  const [trip, setTrip] = useState<Trip | null>(null)
  const [stops, setStops] = useState<ActiveStop[]>([])
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [screenState, setScreenState] = useState<ScreenState>('pre_trip')
  const [loading, setLoading] = useState(true)
  const locationSubRef = useRef<any>(null)

  useEffect(() => {
    loadTrip()
    return () => {
      if (locationSubRef.current) locationSubRef.current.remove()
    }
  }, [tripId])

  const loadTrip = async () => {
    const { data: tripData } = await supabase
      .from('trips')
      .select(`
        *,
        route:routes(name, color),
        vehicle:vehicles(name, plate_number)
      `)
      .eq('id', tripId)
      .single()

    if (!tripData) { navigation.goBack(); return }
    setTrip(tripData as Trip)

    // Charger les arrêts avec les élèves
    const { data: tripStops } = await supabase
      .from('trip_stops')
      .select(`
        *,
        stop:stops(
          *,
          student_stops:student_stops(
            student:students(*)
          )
        )
      `)
      .eq('trip_id', tripId)
      .order('sequence_order')

    if (tripStops) {
      const formattedStops = tripStops.map((ts: any) => ({
        ...ts.stop,
        is_completed: ts.is_completed,
        students: ts.stop?.student_stops?.map((ss: any) => ss.student) ?? [],
      }))
      setStops(formattedStops)
    }

    setLoading(false)
  }

  // Démarrer le trajet + GPS
  const startTrip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Demander permissions GPS
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Accès GPS requis', 'Veuillez autoriser la localisation pour démarrer le trajet.')
      return
    }

    // Mettre à jour statut trajet
    await supabase
      .from('trips')
      .update({ status: 'en_route', actual_start: new Date().toISOString() })
      .eq('id', tripId)

    // Démarrer envoi GPS en continu
    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // 5 secondes
        distanceInterval: 20, // 20 mètres
      },
      async (loc) => {
        await supabase.from('gps_locations').insert({
          trip_id: tripId,
          vehicle_id: trip?.vehicle_id,
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          speed_kmh: loc.coords.speed ? loc.coords.speed * 3.6 : null,
          heading: loc.coords.heading ?? null,
          accuracy: loc.coords.accuracy ?? null,
          altitude: loc.coords.altitude ?? null,
          recorded_at: new Date(loc.timestamp).toISOString(),
        })
      }
    )

    setScreenState('driving')
  }

  // Arrivé à un arrêt
  const arriveAtStop = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const stop = stops[currentStopIndex]

    await supabase
      .from('trip_stops')
      .update({ arrived_at: new Date().toISOString() })
      .eq('trip_id', tripId)
      .eq('stop_id', stop.id)

    setScreenState('at_stop')
  }

  // Confirmer embarquement élève
  const confirmBoarding = async (studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    await supabase.from('attendance').upsert({
      trip_id: tripId,
      student_id: studentId,
      stop_id: stops[currentStopIndex].id,
      driver_id: trip?.driver_id,
      org_id: trip?.org_id,
      status: 'boarded',
      scanned_at: new Date().toISOString(),
    })

    // Mettre à jour l'UI
    setStops(prev => prev.map((s, i) => {
      if (i !== currentStopIndex) return s
      return {
        ...s,
        students: s.students.map(st =>
          st.id === studentId ? { ...st, _boarded: true } as any : st
        ),
      }
    }))

    await supabase
      .from('trips')
      .update({ students_boarded: supabase.rpc('increment', { id: tripId, col: 'students_boarded' }) })
  }

  // Marquer absent
  const markAbsent = async (studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    Alert.alert(
      'Confirmer absence',
      'Marquer cet élève comme absent ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Absent',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('attendance').upsert({
              trip_id: tripId,
              student_id: studentId,
              stop_id: stops[currentStopIndex].id,
              driver_id: trip?.driver_id,
              org_id: trip?.org_id,
              status: 'absent',
            })
            setStops(prev => prev.map((s, i) => {
              if (i !== currentStopIndex) return s
              return {
                ...s,
                students: s.students.map(st =>
                  st.id === studentId ? { ...st, _absent: true } as any : st
                ),
              }
            }))
          },
        },
      ]
    )
  }

  // Quitter l'arrêt → suivant
  const departStop = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const stop = stops[currentStopIndex]

    await supabase
      .from('trip_stops')
      .update({ departed_at: new Date().toISOString(), is_completed: true })
      .eq('trip_id', tripId)
      .eq('stop_id', stop.id)

    setStops(prev => prev.map((s, i) =>
      i === currentStopIndex ? { ...s, is_completed: true } : s
    ))

    if (currentStopIndex + 1 < stops.length) {
      setCurrentStopIndex(i => i + 1)
      setScreenState('driving')
    } else {
      // Dernier arrêt → terminer
      await completeTrip()
    }
  }

  const completeTrip = async () => {
    if (locationSubRef.current) locationSubRef.current.remove()
    await supabase
      .from('trips')
      .update({ status: 'completed', actual_end: new Date().toISOString() })
      .eq('id', tripId)
    setScreenState('completed')
  }

  const reportEmergency = () => {
    Alert.alert(
      '🚨 Urgence',
      'Signaler une urgence au répartiteur ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Signaler urgence',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('trips')
              .update({ status: 'emergency' })
              .eq('id', tripId)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.loadingText}>Chargement du trajet…</Text>
      </SafeAreaView>
    )
  }

  const currentStop = stops[currentStopIndex]

  // ===== ÉCRAN: Pré-trajet =====
  if (screenState === 'pre_trip') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.preTripContainer}>
          <Text style={styles.routeName}>{(trip as any)?.route?.name}</Text>
          <Text style={styles.vehicleName}>{(trip as any)?.vehicle?.name}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{stops.length}</Text>
              <Text style={styles.statLabel}>Arrêts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>
                {stops.reduce((a, s) => a + s.students.length, 0)}
              </Text>
              <Text style={styles.statLabel}>Élèves</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={startTrip}>
            <Text style={styles.startBtnText}>Démarrer le trajet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inspectBtn}
            onPress={() => navigation.navigate('Inspection', { tripId })}
          >
            <Text style={styles.inspectBtnText}>Inspection du véhicule</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ===== ÉCRAN: En route =====
  if (screenState === 'driving') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#072B57' }]}>
        <View style={styles.drivingContainer}>
          {/* Stop suivant — GROS */}
          <View style={styles.nextStopCard}>
            <Text style={styles.nextStopLabel}>Prochain arrêt</Text>
            <Text style={styles.nextStopName}>{currentStop?.name}</Text>
            <Text style={styles.nextStopAddress}>{currentStop?.address}</Text>
            <Text style={styles.nextStopStudents}>
              {currentStop?.students.length} élève{currentStop?.students.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Bouton ARRIVÉ — très grand */}
          <TouchableOpacity style={styles.arrivedBtn} onPress={arriveAtStop}>
            <Text style={styles.arrivedBtnText}>Je suis arrivé</Text>
          </TouchableOpacity>

          {/* Progression */}
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              Arrêt {currentStopIndex + 1} / {stops.length}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${((currentStopIndex) / stops.length) * 100}%`
              }]} />
            </View>
          </View>

          {/* Bouton urgence */}
          <TouchableOpacity style={styles.emergencyBtn} onPress={reportEmergency}>
            <Text style={styles.emergencyBtnText}>🚨 Urgence</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ===== ÉCRAN: À l'arrêt — Présence élèves =====
  if (screenState === 'at_stop') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.atStopHeader}>
          <Text style={styles.atStopTitle}>{currentStop?.name}</Text>
          <Text style={styles.atStopSub}>Confirmer la présence</Text>
        </View>

        <FlatList
          data={currentStop?.students ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.studentList}
          renderItem={({ item }) => {
            const boarded = (item as any)._boarded
            const absent = (item as any)._absent
            return (
              <View style={[
                styles.studentRow,
                boarded && styles.studentBoarded,
                absent && styles.studentAbsent,
              ]}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>
                    {item.first_name[0]}{item.last_name[0]}
                  </Text>
                </View>
                <View style={styles.studentName}>
                  <Text style={styles.studentFullName}>
                    {item.first_name} {item.last_name}
                  </Text>
                  <Text style={styles.studentGrade}>
                    {item.grade ? `Grade ${item.grade}` : ''}
                    {item.special_needs ? ' · Besoins spéciaux' : ''}
                  </Text>
                </View>

                {!boarded && !absent && (
                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      style={styles.boardBtn}
                      onPress={() => confirmBoarding(item.id)}
                    >
                      <Text style={styles.boardBtnText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.absentBtn}
                      onPress={() => markAbsent(item.id)}
                    >
                      <Text style={styles.absentBtnText}>✗</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {boarded && <Text style={styles.statusText}>À bord ✓</Text>}
                {absent && <Text style={styles.absentStatusText}>Absent</Text>}
              </View>
            )
          }}
        />

        <View style={styles.departContainer}>
          <TouchableOpacity style={styles.departBtn} onPress={departStop}>
            <Text style={styles.departBtnText}>
              {currentStopIndex + 1 < stops.length ? 'Arrêt suivant →' : 'Terminer le trajet'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ===== ÉCRAN: Trajet terminé =====
  return (
    <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ fontSize: 64 }}>✅</Text>
      <Text style={[styles.routeName, { color: '#34C759', marginTop: 16 }]}>Trajet terminé!</Text>
      <Text style={styles.atStopSub}>Tous les élèves ont été déposés.</Text>
      <TouchableOpacity style={[styles.startBtn, { marginTop: 32 }]} onPress={() => navigation.goBack()}>
        <Text style={styles.startBtnText}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#5578AA', fontFamily: 'Inter_400Regular' },

  // Pré-trajet
  preTripContainer: { flex: 1, padding: 24, justifyContent: 'center' },
  routeName: { fontSize: 28, fontWeight: '700', color: '#072B57', fontFamily: 'Poppins_700Bold', textAlign: 'center' },
  vehicleName: { fontSize: 18, color: '#5578AA', textAlign: 'center', marginTop: 4, fontFamily: 'Inter_400Regular' },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 32, marginBottom: 32 },
  statBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#072B57', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statNum: { fontSize: 40, fontWeight: '700', color: '#072B57', fontFamily: 'Poppins_700Bold' },
  statLabel: { fontSize: 14, color: '#5578AA', marginTop: 4 },
  startBtn: { backgroundColor: '#16C7B8', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  startBtnText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Poppins_700Bold' },
  inspectBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#C4D0E3' },
  inspectBtnText: { fontSize: 16, fontWeight: '500', color: '#5578AA', fontFamily: 'Inter_500Medium' },

  // En route
  drivingContainer: { flex: 1, padding: 20, justifyContent: 'center', gap: 20 },
  nextStopCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  nextStopLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  nextStopName: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Poppins_700Bold', lineHeight: 38 },
  nextStopAddress: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontFamily: 'Inter_400Regular' },
  nextStopStudents: { fontSize: 15, color: '#16C7B8', fontFamily: 'Inter_600SemiBold', fontWeight: '600', marginTop: 8 },
  arrivedBtn: { backgroundColor: '#34C759', borderRadius: 20, paddingVertical: 24, alignItems: 'center' },
  arrivedBtnText: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Poppins_700Bold' },
  progressRow: { gap: 8 },
  progressText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#16C7B8', borderRadius: 2 },
  emergencyBtn: { paddingVertical: 14, alignItems: 'center' },
  emergencyBtnText: { fontSize: 16, color: '#FF6B6B', fontFamily: 'Inter_600SemiBold', fontWeight: '600' },

  // À l'arrêt
  atStopHeader: { backgroundColor: '#072B57', padding: 20, paddingBottom: 16 },
  atStopTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Poppins_700Bold' },
  atStopSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontFamily: 'Inter_400Regular' },
  studentList: { padding: 16, gap: 10 },
  studentRow: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#072B57', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  studentBoarded: { backgroundColor: '#E8F8F1', borderWidth: 1.5, borderColor: '#34C759' },
  studentAbsent: { backgroundColor: '#FFF0EF', borderWidth: 1.5, borderColor: '#FF3B30' },
  studentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F9F7', alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 16, fontWeight: '700', color: '#16C7B8', fontFamily: 'Poppins_700Bold' },
  studentName: { flex: 1 },
  studentFullName: { fontSize: 16, fontWeight: '600', color: '#072B57', fontFamily: 'Poppins_600SemiBold' },
  studentGrade: { fontSize: 12, color: '#9BB0CE', fontFamily: 'Inter_400Regular', marginTop: 2 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  boardBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center' },
  boardBtnText: { fontSize: 22, color: '#FFFFFF', fontWeight: '700' },
  absentBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  absentBtnText: { fontSize: 22, color: '#FFFFFF', fontWeight: '700' },
  statusText: { fontSize: 13, color: '#34C759', fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  absentStatusText: { fontSize: 13, color: '#FF3B30', fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  departContainer: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 4 : 16 },
  departBtn: { backgroundColor: '#072B57', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  departBtnText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Poppins_700Bold' },
})
