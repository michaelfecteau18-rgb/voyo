import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  StyleSheet, StatusBar, Platform, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useRealtimeTrip } from '@/hooks/useRealtimeTrip'
import type { ParentDashboardRow } from '@voyo/types'

// Composants
import { StudentCard }     from '@/components/StudentCard'
import { QuickActions }    from '@/components/QuickActions'
import { NotificationList } from '@/components/NotificationList'
import { VoyoLogo }        from '@/components/VoyoLogo'

const { width: SCREEN_W } = Dimensions.get('window')

export default function ParentDashboard({ navigation }: any) {
  const [children, setChildren] = useState<ParentDashboardRow[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [parentName, setParentName] = useState('')

  useEffect(() => {
    loadDashboard()
    computeGreeting()
  }, [])

  // Realtime pour les trajets actifs
  useRealtimeTrip(
    children.map(c => c.trip_id).filter(Boolean) as string[],
    (tripId, update) => {
      setChildren(prev =>
        prev.map(c =>
          c.trip_id === tripId ? { ...c, ...update } : c
        )
      )
    }
  )

  const computeGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) setGreeting('Bonjour')
    else if (h < 18) setGreeting('Bon après-midi')
    else setGreeting('Bonsoir')
  }

  const loadDashboard = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .single()

    if (profile) setParentName(profile.first_name)

    const { data: dashData } = await supabase
      .from('parent_dashboard')
      .select('*')
      .eq('parent_id', (await supabase.auth.getUser()).data.user?.id ?? '')

    if (dashData) setChildren(dashData)

    const { data: notifData } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .order('created_at', { ascending: false })
      .limit(10)

    if (notifData) setNotifications(notifData)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
  }, [])

  // Résumé statuts
  const onRoad = children.filter(c => c.trip_status === 'en_route').length
  const arrived = children.filter(c => c.attendance_status === 'present_at_school').length

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#16C7B8"
            colors={['#16C7B8']}
          />
        }
      >
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{parentName || 'Marie'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel="Notifications"
            >
              <BellIcon />
              {notifications.some(n => !n.read_at) && (
                <View style={styles.notifBadge} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.avatarText}>
                {parentName?.[0] ?? 'M'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Résumé du jour */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: '#E8F8F1' }]}>
            <Text style={[styles.summaryNum, { color: '#34C759' }]}>{onRoad}</Text>
            <Text style={styles.summaryLabel}>En route</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#E8EDF4' }]}>
            <Text style={[styles.summaryNum, { color: '#072B57' }]}>{arrived}</Text>
            <Text style={styles.summaryLabel}>À l'école</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#E0F9F7' }]}>
            <Text style={[styles.summaryNum, { color: '#16C7B8' }]}>{children.length}</Text>
            <Text style={styles.summaryLabel}>Enfants</Text>
          </View>
        </View>

        {/* Cartes enfants */}
        <Text style={styles.sectionTitle}>Mes enfants</Text>

        {children.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚌</Text>
            <Text style={styles.emptyTitle}>Aucun trajet aujourd'hui</Text>
            <Text style={styles.emptyBody}>
              Bonne nouvelle — pas de transport prévu ce matin.
            </Text>
          </View>
        ) : (
          children.map(child => (
            <StudentCard
              key={child.student_id}
              child={child}
              onPress={() => navigation.navigate('LiveMap', {
                tripId: child.trip_id,
                studentId: child.student_id,
              })}
            />
          ))
        )}

        {/* Actions rapides */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <QuickActions navigation={navigation} />

        {/* Notifications récentes */}
        {notifications.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notifications récentes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            <NotificationList
              notifications={notifications.slice(0, 5)}
              onPress={(n) => navigation.navigate('Notifications')}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 15,
    color: '#5578AA',
    fontFamily: 'Inter_400Regular',
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: '#072B57',
    fontFamily: 'Poppins_700Bold',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#072B57',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#F5F7FA',
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#072B57',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins_600SemiBold',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    lineHeight: 34,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#5578AA',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#072B57',
    fontFamily: 'Poppins_600SemiBold',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  seeAll: {
    fontSize: 13,
    color: '#16C7B8',
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  emptyState: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#072B57',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#072B57',
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: '#5578AA',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
})

const BellIcon = () => (
  // Simple bell SVG rendu via React Native SVG
  null // Remplacer par @expo/vector-icons ou react-native-svg
)
