import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format, isToday, isYesterday } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'

export default function TripHistoryScreen({ navigation }: any) {
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadHistory() }, [])

  const loadHistory = async () => {
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return

    // Trouver les enfants du parent
    const { data: children } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_id', user.id)

    if (!children?.length) { setLoading(false); return }

    const studentIds = children.map(c => c.student_id)

    // Charger l'historique de présence
    const { data } = await supabase
      .from('attendance')
      .select(`
        *,
        student:students(first_name, last_name, photo_url),
        trip:trips(
          trip_date, route_type, delay_minutes, status,
          vehicle:vehicles(name),
          route:routes(name)
        )
      `)
      .in('student_id', studentIds)
      .in('status', ['boarded', 'dropped_off', 'present_at_school'])
      .order('scanned_at', { ascending: false })
      .limit(60)

    if (data) setTrips(data)
    setLoading(false)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadHistory()
    setRefreshing(false)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isToday(d)) return 'Aujourd\'hui'
    if (isYesterday(d)) return 'Hier'
    return format(d, 'EEEE d MMMM', { locale: fr })
  }

  const groupedTrips = trips.reduce((acc, trip) => {
    const dateKey = trip.trip?.trip_date ?? format(new Date(trip.scanned_at), 'yyyy-MM-dd')
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(trip)
    return acc
  }, {} as Record<string, typeof trips>)

  const sections = Object.entries(groupedTrips)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique des trajets</Text>
      </View>

      {trips.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Aucun historique</Text>
          <Text style={styles.emptyBody}>L'historique de vos trajets apparaîtra ici.</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={s => s.date}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16C7B8" />}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item: section }) => (
            <View>
              <View style={styles.dateHeader}>
                <Text style={styles.dateText}>{formatDate(section.date)}</Text>
              </View>
              {section.items.map((att: any) => {
                const isOnTime = (att.trip?.delay_minutes ?? 0) <= 5
                return (
                  <TouchableOpacity key={att.id} style={styles.tripCard}>
                    <View style={[styles.typeIndicator,
                      att.trip?.route_type === 'morning' ? styles.typeMorning : styles.typeAfternoon
                    ]}>
                      <Text style={styles.typeText}>
                        {att.trip?.route_type === 'morning' ? 'AM' : 'PM'}
                      </Text>
                    </View>
                    <View style={styles.tripInfo}>
                      <Text style={styles.studentName}>
                        {att.student?.first_name} {att.student?.last_name}
                      </Text>
                      <Text style={styles.routeName}>
                        {att.trip?.route?.name ?? att.trip?.vehicle?.name ?? '—'}
                      </Text>
                      <Text style={styles.time}>
                        {format(new Date(att.scanned_at), 'HH:mm')}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge,
                      att.status === 'present_at_school' ? styles.statusGreen :
                      att.status === 'boarded' ? styles.statusBlue : styles.statusGray
                    ]}>
                      <Text style={[styles.statusText,
                        att.status === 'present_at_school' ? { color: '#34C759' } :
                        att.status === 'boarded' ? { color: '#2D8CFF' } : { color: '#9BB0CE' }
                      ]}>
                        {att.status === 'present_at_school' ? 'À l\'école' :
                         att.status === 'boarded' ? 'À bord' : 'Déposé'}
                      </Text>
                      {!isOnTime && (
                        <Text style={styles.delayText}>+{att.trip?.delay_minutes}min</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: {
    fontSize: 24, fontWeight: '700', color: '#072B57',
    fontFamily: 'Poppins_700Bold',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#072B57', fontFamily: 'Poppins_600SemiBold', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#9BB0CE', textAlign: 'center', fontFamily: 'Inter_400Regular' },
  dateHeader: {
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: '#F5F7FA',
  },
  dateText: {
    fontSize: 13, fontWeight: '600', color: '#9BB0CE',
    fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize',
  },
  tripCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, padding: 14,
    shadowColor: '#072B57', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  typeIndicator: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  typeMorning: { backgroundColor: '#FFF5E6' },
  typeAfternoon: { backgroundColor: '#E8EDF4' },
  typeText: { fontSize: 12, fontWeight: '700', color: '#FF9500', fontFamily: 'Poppins_700Bold' },
  tripInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#072B57', fontFamily: 'Poppins_600SemiBold' },
  routeName: { fontSize: 12, color: '#9BB0CE', fontFamily: 'Inter_400Regular', marginTop: 1 },
  time: { fontSize: 11, color: '#C4D0E3', fontFamily: 'Inter_400Regular', marginTop: 2 },
  statusBadge: {
    alignItems: 'flex-end',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  statusGreen: { backgroundColor: '#E8F8F1' },
  statusBlue: { backgroundColor: '#EBF4FF' },
  statusGray: { backgroundColor: '#F0F4F8' },
  statusText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  delayText: { fontSize: 10, color: '#FF9500', fontFamily: 'Inter_600SemiBold', marginTop: 2 },
})
