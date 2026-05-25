// ============================================================
// VOYO — Types TypeScript de la base de données
// Auto-généré via: supabase gen types typescript
// ============================================================

export type UserRole = 'super_admin' | 'org_admin' | 'dispatcher' | 'driver' | 'parent' | 'school_admin'
export type TripStatus = 'scheduled' | 'en_route' | 'delayed' | 'completed' | 'cancelled' | 'emergency'
export type NotificationType = 'bus_departed' | 'bus_approaching' | 'student_boarded' | 'student_absent' | 'student_dropped_off' | 'arrival_at_school' | 'delay_alert' | 'emergency' | 'route_change' | 'weather_alert' | 'custom'
export type NotificationChannel = 'push' | 'sms' | 'email' | 'in_app'
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read'
export type AttendanceStatus = 'boarded' | 'absent' | 'dropped_off' | 'present_at_school'
export type RouteType = 'morning' | 'afternoon' | 'special' | 'field_trip' | 'emergency'
export type VehicleStatus = 'active' | 'inactive' | 'maintenance' | 'out_of_service'
export type MessageStatus = 'sent' | 'delivered' | 'read'

export interface Organisation {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
  address: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country: string
  phone: string | null
  email: string | null
  website: string | null
  timezone: string
  locale: string
  plan: string
  max_vehicles: number
  max_students: number
  trial_ends_at: string | null
  subscription_id: string | null
  sms_enabled: boolean
  push_enabled: boolean
  email_enabled: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  org_id: string | null
  role: UserRole
  first_name: string
  last_name: string
  phone: string | null
  avatar_url: string | null
  locale: string
  timezone: string
  push_token: string | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface School {
  id: string
  org_id: string
  name: string
  address: string
  city: string
  province: string
  postal_code: string | null
  phone: string | null
  contact_name: string | null
  contact_email: string | null
  location: unknown | null // PostGIS
  geofence_radius: number
  arrival_time_am: string
  departure_time_pm: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  org_id: string
  name: string
  plate_number: string
  make: string | null
  model: string | null
  year: number | null
  capacity: number
  status: VehicleStatus
  color: string | null
  notes: string | null
  last_maintenance: string | null
  next_maintenance: string | null
  created_at: string
  updated_at: string
}

export interface Driver {
  id: string
  org_id: string
  profile_id: string | null
  employee_number: string | null
  license_number: string
  license_expiry: string
  license_class: string
  phone_direct: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // Jointures
  profile?: Profile
}

export interface Student {
  id: string
  org_id: string
  school_id: string | null
  first_name: string
  last_name: string
  student_number: string | null
  grade: string | null
  photo_url: string | null
  date_of_birth: string | null
  special_needs: boolean
  medical_notes: string | null
  special_instructions: string | null
  requires_wheelchair: boolean
  requires_aide: boolean
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_rel: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Jointures
  school?: School
  parents?: Profile[]
  attendance_status?: AttendanceStatus
}

export interface Route {
  id: string
  org_id: string
  school_id: string | null
  name: string
  description: string | null
  route_type: RouteType
  is_recurring: boolean
  recurring_days: number[]
  scheduled_start: string | null
  estimated_duration: number | null
  total_stops: number
  is_active: boolean
  color: string
  created_at: string
  updated_at: string
  // Jointures
  school?: School
  stops?: Stop[]
  current_assignment?: RouteAssignment
}

export interface RouteAssignment {
  id: string
  route_id: string
  vehicle_id: string | null
  driver_id: string | null
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
  // Jointures
  vehicle?: Vehicle
  driver?: Driver
}

export interface Stop {
  id: string
  route_id: string
  org_id: string
  name: string
  address: string | null
  location: unknown | null
  sequence_order: number
  scheduled_time: string | null
  geofence_radius: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Jointures
  students?: Student[]
}

export interface Trip {
  id: string
  route_id: string
  vehicle_id: string | null
  driver_id: string | null
  org_id: string
  trip_date: string
  status: TripStatus
  route_type: RouteType
  scheduled_start: string | null
  actual_start: string | null
  scheduled_end: string | null
  actual_end: string | null
  estimated_end: string | null
  delay_minutes: number
  delay_reason: string | null
  students_total: number
  students_boarded: number
  students_absent: number
  distance_km: number | null
  notes: string | null
  emergency_note: string | null
  created_at: string
  updated_at: string
  // Jointures
  route?: Route
  vehicle?: Vehicle
  driver?: Driver
  current_stops?: TripStop[]
}

export interface TripStop {
  id: string
  trip_id: string
  stop_id: string
  sequence_order: number
  scheduled_time: string | null
  estimated_time: string | null
  arrived_at: string | null
  departed_at: string | null
  is_completed: boolean
  delay_minutes: number
  created_at: string
  // Jointures
  stop?: Stop
}

export interface GpsLocation {
  id: number
  trip_id: string
  vehicle_id: string
  location: unknown
  lat: number
  lng: number
  speed_kmh: number | null
  heading: number | null
  accuracy: number | null
  altitude: number | null
  recorded_at: string
  created_at: string
}

export interface Attendance {
  id: string
  trip_id: string
  student_id: string
  stop_id: string | null
  driver_id: string | null
  org_id: string
  status: AttendanceStatus
  scanned_at: string
  location: unknown | null
  photo_url: string | null
  notes: string | null
  created_at: string
  // Jointures
  student?: Student
}

export interface Notification {
  id: string
  org_id: string
  recipient_id: string
  student_id: string | null
  trip_id: string | null
  type: NotificationType
  channel: NotificationChannel
  status: NotificationStatus
  title: string
  body: string
  data: Record<string, unknown>
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  failed_at: string | null
  failure_reason: string | null
  twilio_sid: string | null
  firebase_id: string | null
  created_at: string
}

export interface Message {
  id: string
  org_id: string
  conversation_id: string
  sender_id: string
  recipient_id: string | null
  trip_id: string | null
  body: string
  is_broadcast: boolean
  status: MessageStatus
  read_at: string | null
  created_at: string
  // Jointures
  sender?: Profile
}

export interface VehicleInspection {
  id: string
  vehicle_id: string
  driver_id: string
  org_id: string
  trip_id: string | null
  inspection_type: string
  overall_status: string
  items: InspectionItem[]
  notes: string | null
  completed_at: string
  created_at: string
}

export interface InspectionItem {
  name: string
  status: 'pass' | 'fail' | 'na'
  notes?: string
}

// Vues
export interface ActiveVehicleStatus {
  vehicle_id: string
  vehicle_name: string
  plate_number: string
  trip_id: string | null
  trip_status: TripStatus | null
  delay_minutes: number | null
  driver_id: string | null
  driver_name: string | null
  lat: number | null
  lng: number | null
  speed_kmh: number | null
  last_update: string | null
  org_id: string
}

export interface ParentDashboardRow {
  parent_id: string
  student_id: string
  student_name: string
  photo_url: string | null
  trip_id: string | null
  trip_status: TripStatus | null
  delay_minutes: number | null
  estimated_end: string | null
  vehicle_name: string | null
  driver_name: string | null
  attendance_status: AttendanceStatus | null
  boarded_at: string | null
}

// Payloads Realtime
export interface RealtimeGpsPayload {
  trip_id: string
  vehicle_id: string
  lat: number
  lng: number
  speed_kmh: number
  heading: number
  recorded_at: string
}

export interface RealtimeTripPayload {
  trip_id: string
  status: TripStatus
  delay_minutes: number
  estimated_end: string | null
}
