import React from 'react'
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, Animated,
} from 'react-native'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { ParentDashboardRow } from '@voyo/types'

interface StudentCardProps {
  child: ParentDashboardRow
  onPress: () => void
}

export function StudentCard({ child, onPress }: StudentCardProps) {
  const status = getStatus(child)

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`Voir le trajet de ${child.student_name}`}
    >
      {/* En-tête enfant */}
      <View style={styles.cardHeader}>
        {/* Photo / initiales */}
        {child.photo_url ? (
          <Image source={{ uri: child.photo_url }} style={styles.photo} />
        ) : (
          <View style={[styles.initials, { backgroundColor: status.bg }]}>
            <Text style={[styles.initialsText, { color: status.color }]}>
              {child.student_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        )}

        <View style={styles.nameBlock}>
          <Text style={styles.studentName}>{child.student_name}</Text>
          {child.vehicle_name && (
            <Text style={styles.busName}>{child.vehicle_name}</Text>
          )}
        </View>

        {/* Badge statut */}
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Barre de progression itinéraire */}
      {child.trip_id && child.trip_status !== 'completed' && (
        <View style={styles.progress}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${getProgressPercent(child)}%`, backgroundColor: status.color },
              ]}
            />
          </View>
        </View>
      )}

      {/* Infos trajet */}
      <View style={styles.tripInfo}>
        {/* ETA */}
        {child.estimated_end && child.trip_status !== 'completed' && (
          <View style={styles.infoItem}>
            <ClockIcon color={status.color} />
            <Text style={styles.infoText}>
              Arrivée vers{' '}
              <Text style={[styles.infoValue, { color: status.color }]}>
                {format(new Date(child.estimated_end), 'HH:mm')}
              </Text>
            </Text>
          </View>
        )}

        {/* Retard */}
        {(child.delay_minutes ?? 0) > 0 && (
          <View style={styles.delayBadge}>
            <Text style={styles.delayText}>
              +{child.delay_minutes} min de retard
            </Text>
          </View>
        )}

        {/* Montée / descente */}
        {child.boarded_at && (
          <View style={styles.infoItem}>
            <CheckIcon />
            <Text style={styles.infoText}>
              Monté à bord à{' '}
              <Text style={styles.infoValue}>
                {format(new Date(child.boarded_at), 'HH:mm')}
              </Text>
            </Text>
          </View>
        )}

        {/* Chauffeur */}
        {child.driver_name && (
          <View style={styles.infoItem}>
            <DriverIcon />
            <Text style={styles.infoText}>{child.driver_name}</Text>
          </View>
        )}
      </View>

      {/* Bouton voir la carte */}
      {child.trip_id && child.trip_status === 'en_route' && (
        <View style={styles.cardFooter}>
          <Text style={styles.trackBtn}>
            Suivre en direct →
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

function getStatus(child: ParentDashboardRow) {
  if (!child.trip_id) return { label: 'Pas de trajet', color: '#9BB0CE', bg: '#F0F4F8' }

  const delay = child.delay_minutes ?? 0

  if (child.trip_status === 'emergency') {
    return { label: 'Urgence', color: '#FF3B30', bg: '#FFF0EF' }
  }
  if (child.attendance_status === 'present_at_school') {
    return { label: 'À l\'école', color: '#34C759', bg: '#E8F8F1' }
  }
  if (child.attendance_status === 'boarded' && delay > 5) {
    return { label: 'En retard', color: '#FF9500', bg: '#FFF5E6' }
  }
  if (child.attendance_status === 'boarded') {
    return { label: 'En route', color: '#34C759', bg: '#E8F8F1' }
  }
  if (child.attendance_status === 'absent') {
    return { label: 'Absent', color: '#FF3B30', bg: '#FFF0EF' }
  }
  if (child.trip_status === 'en_route') {
    return { label: 'En route', color: '#16C7B8', bg: '#E0F9F7' }
  }
  return { label: 'Planifié', color: '#5578AA', bg: '#E8EDF4' }
}

function getProgressPercent(child: ParentDashboardRow): number {
  if (!child.trip_id) return 0
  if (child.attendance_status === 'present_at_school') return 100
  if (child.attendance_status === 'boarded') return 60
  if (child.trip_status === 'en_route') return 30
  return 0
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#072B57',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  photo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  initials: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  nameBlock: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#072B57',
    fontFamily: 'Poppins_600SemiBold',
  },
  busName: {
    fontSize: 13,
    color: '#5578AA',
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  progress: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#F0F4F8',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  tripInfo: {
    gap: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#5578AA',
    fontFamily: 'Inter_400Regular',
  },
  infoValue: {
    color: '#072B57',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  delayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  delayText: {
    fontSize: 12,
    color: '#FF9500',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  trackBtn: {
    fontSize: 13,
    color: '#16C7B8',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },
})

// Icônes simples (remplacer par @expo/vector-icons en prod)
const ClockIcon = ({ color }: { color: string }) => null
const CheckIcon = () => null
const DriverIcon = () => null
