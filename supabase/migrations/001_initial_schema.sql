-- ============================================================
-- VOYO — Schema PostgreSQL complet
-- Migration 001 — Schema initial
-- Auteur: VOYO Platform Team
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- TYPES ÉNUMÉRÉS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'org_admin',
  'dispatcher',
  'driver',
  'parent',
  'school_admin'
);

CREATE TYPE trip_status AS ENUM (
  'scheduled',
  'en_route',
  'delayed',
  'completed',
  'cancelled',
  'emergency'
);

CREATE TYPE notification_type AS ENUM (
  'bus_departed',
  'bus_approaching',
  'student_boarded',
  'student_absent',
  'student_dropped_off',
  'arrival_at_school',
  'delay_alert',
  'emergency',
  'route_change',
  'weather_alert',
  'custom'
);

CREATE TYPE notification_channel AS ENUM (
  'push',
  'sms',
  'email',
  'in_app'
);

CREATE TYPE notification_status AS ENUM (
  'pending',
  'sent',
  'delivered',
  'failed',
  'read'
);

CREATE TYPE attendance_status AS ENUM (
  'boarded',
  'absent',
  'dropped_off',
  'present_at_school'
);

CREATE TYPE route_type AS ENUM (
  'morning',
  'afternoon',
  'special',
  'field_trip',
  'emergency'
);

CREATE TYPE vehicle_status AS ENUM (
  'active',
  'inactive',
  'maintenance',
  'out_of_service'
);

CREATE TYPE message_status AS ENUM (
  'sent',
  'delivered',
  'read'
);

CREATE TYPE inspection_item_status AS ENUM (
  'pass',
  'fail',
  'na'
);

-- ============================================================
-- TABLE: organisations
-- Multi-tenant core — chaque transporteur est une org
-- ============================================================

CREATE TABLE organisations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  logo_url          TEXT,
  primary_color     TEXT DEFAULT '#072B57',
  address           TEXT,
  city              TEXT,
  province          TEXT,
  postal_code       TEXT,
  country           TEXT DEFAULT 'CA',
  phone             TEXT,
  email             TEXT,
  website           TEXT,
  timezone          TEXT DEFAULT 'America/Toronto',
  locale            TEXT DEFAULT 'fr',

  -- Abonnement
  plan              TEXT DEFAULT 'starter', -- starter, pro, enterprise
  max_vehicles      INT DEFAULT 10,
  max_students      INT DEFAULT 500,
  trial_ends_at     TIMESTAMPTZ,
  subscription_id   TEXT, -- Stripe

  -- Paramètres
  sms_enabled       BOOLEAN DEFAULT true,
  push_enabled      BOOLEAN DEFAULT true,
  email_enabled     BOOLEAN DEFAULT true,

  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orgs_slug ON organisations(slug);
CREATE INDEX idx_orgs_active ON organisations(is_active);

-- ============================================================
-- TABLE: profiles (extension de auth.users Supabase)
-- ============================================================

CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id            UUID REFERENCES organisations(id) ON DELETE SET NULL,
  role              user_role NOT NULL DEFAULT 'parent',
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  phone             TEXT,
  avatar_url        TEXT,
  locale            TEXT DEFAULT 'fr',
  timezone          TEXT DEFAULT 'America/Toronto',
  push_token        TEXT, -- Firebase FCM token
  is_active         BOOLEAN DEFAULT true,
  last_seen_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_org ON profiles(org_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================================
-- TABLE: schools
-- ============================================================

CREATE TABLE schools (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  address           TEXT NOT NULL,
  city              TEXT NOT NULL,
  province          TEXT NOT NULL,
  postal_code       TEXT,
  phone             TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  location          GEOGRAPHY(POINT, 4326), -- PostGIS point
  geofence_radius   INT DEFAULT 200, -- metres
  arrival_time_am   TIME DEFAULT '08:30',
  departure_time_pm TIME DEFAULT '15:30',
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schools_org ON schools(org_id);
CREATE INDEX idx_schools_location ON schools USING GIST(location);

-- ============================================================
-- TABLE: vehicles
-- ============================================================

CREATE TABLE vehicles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL, -- "Autobus 17"
  plate_number      TEXT NOT NULL,
  make              TEXT,
  model             TEXT,
  year              INT,
  capacity          INT DEFAULT 48,
  status            vehicle_status DEFAULT 'active',
  color             TEXT,
  notes             TEXT,
  last_maintenance  DATE,
  next_maintenance  DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, plate_number)
);

CREATE INDEX idx_vehicles_org ON vehicles(org_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);

-- ============================================================
-- TABLE: drivers
-- ============================================================

CREATE TABLE drivers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  profile_id        UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  employee_number   TEXT,
  license_number    TEXT NOT NULL,
  license_expiry    DATE NOT NULL,
  license_class     TEXT DEFAULT 'C',
  phone_direct      TEXT,
  is_active         BOOLEAN DEFAULT true,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drivers_org ON drivers(org_id);
CREATE INDEX idx_drivers_profile ON drivers(profile_id);

-- ============================================================
-- TABLE: students
-- ============================================================

CREATE TABLE students (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  school_id         UUID REFERENCES schools(id) ON DELETE SET NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  student_number    TEXT,
  grade             TEXT,
  photo_url         TEXT,
  date_of_birth     DATE,

  -- Besoins spéciaux
  special_needs     BOOLEAN DEFAULT false,
  medical_notes     TEXT,
  special_instructions TEXT,
  requires_wheelchair BOOLEAN DEFAULT false,
  requires_aide     BOOLEAN DEFAULT false,

  -- Contacts d'urgence
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_rel   TEXT,

  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_students_org ON students(org_id);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_name ON students(last_name, first_name);

-- ============================================================
-- TABLE: parent_students (relation many-to-many)
-- ============================================================

CREATE TABLE parent_students (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship      TEXT DEFAULT 'parent', -- parent, tuteur, grand-parent
  is_primary        BOOLEAN DEFAULT false,
  can_pickup        BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, student_id)
);

CREATE INDEX idx_ps_parent ON parent_students(parent_id);
CREATE INDEX idx_ps_student ON parent_students(student_id);

-- ============================================================
-- TABLE: routes
-- ============================================================

CREATE TABLE routes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  school_id         UUID REFERENCES schools(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  route_type        route_type DEFAULT 'morning',
  is_recurring      BOOLEAN DEFAULT true,
  recurring_days    INT[] DEFAULT '{1,2,3,4,5}', -- 1=lundi, 5=vendredi
  scheduled_start   TIME,
  estimated_duration INT, -- minutes
  total_stops       INT DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  color             TEXT DEFAULT '#16C7B8', -- pour la carte
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_routes_org ON routes(org_id);
CREATE INDEX idx_routes_school ON routes(school_id);
CREATE INDEX idx_routes_type ON routes(route_type);

-- ============================================================
-- TABLE: route_assignments (véhicule + chauffeur par route)
-- ============================================================

CREATE TABLE route_assignments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id          UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  vehicle_id        UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id         UUID REFERENCES drivers(id) ON DELETE SET NULL,
  valid_from        DATE NOT NULL,
  valid_until       DATE,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ra_route ON route_assignments(route_id);
CREATE INDEX idx_ra_vehicle ON route_assignments(vehicle_id);
CREATE INDEX idx_ra_driver ON route_assignments(driver_id);

-- ============================================================
-- TABLE: stops (arrêts sur une route)
-- ============================================================

CREATE TABLE stops (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id          UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  address           TEXT,
  location          GEOGRAPHY(POINT, 4326),
  sequence_order    INT NOT NULL,
  scheduled_time    TIME,
  geofence_radius   INT DEFAULT 50, -- metres
  notes             TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stops_route ON stops(route_id);
CREATE INDEX idx_stops_location ON stops USING GIST(location);
CREATE INDEX idx_stops_sequence ON stops(route_id, sequence_order);

-- ============================================================
-- TABLE: student_stops (quel élève à quel arrêt)
-- ============================================================

CREATE TABLE student_stops (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  stop_id           UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  route_id          UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_type         TEXT DEFAULT 'pickup', -- pickup, dropoff, both
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, route_id, stop_type)
);

CREATE INDEX idx_ss_student ON student_stops(student_id);
CREATE INDEX idx_ss_stop ON student_stops(stop_id);

-- ============================================================
-- TABLE: trips (chaque trajet concret)
-- ============================================================

CREATE TABLE trips (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id          UUID NOT NULL REFERENCES routes(id),
  vehicle_id        UUID REFERENCES vehicles(id),
  driver_id         UUID REFERENCES drivers(id),
  org_id            UUID NOT NULL REFERENCES organisations(id),

  trip_date         DATE NOT NULL,
  status            trip_status DEFAULT 'scheduled',
  route_type        route_type DEFAULT 'morning',

  -- Horaires
  scheduled_start   TIMESTAMPTZ,
  actual_start      TIMESTAMPTZ,
  scheduled_end     TIMESTAMPTZ,
  actual_end        TIMESTAMPTZ,
  estimated_end     TIMESTAMPTZ, -- ETA calculé dynamiquement

  -- Délai
  delay_minutes     INT DEFAULT 0,
  delay_reason      TEXT,

  -- Statistiques
  students_total    INT DEFAULT 0,
  students_boarded  INT DEFAULT 0,
  students_absent   INT DEFAULT 0,
  distance_km       DECIMAL(8,2),

  -- Notes
  notes             TEXT,
  emergency_note    TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_org_date ON trips(org_id, trip_date);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_date ON trips(trip_date);

-- ============================================================
-- TABLE: trip_stops (progression sur les arrêts)
-- ============================================================

CREATE TABLE trip_stops (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id           UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_id           UUID NOT NULL REFERENCES stops(id),
  sequence_order    INT NOT NULL,
  scheduled_time    TIMESTAMPTZ,
  estimated_time    TIMESTAMPTZ,
  arrived_at        TIMESTAMPTZ,
  departed_at       TIMESTAMPTZ,
  is_completed      BOOLEAN DEFAULT false,
  delay_minutes     INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ts_trip ON trip_stops(trip_id);
CREATE INDEX idx_ts_stop ON trip_stops(stop_id);
CREATE INDEX idx_ts_sequence ON trip_stops(trip_id, sequence_order);

-- ============================================================
-- TABLE: gps_locations (données GPS en temps réel)
-- ============================================================

CREATE TABLE gps_locations (
  id                BIGSERIAL PRIMARY KEY,
  trip_id           UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id        UUID NOT NULL REFERENCES vehicles(id),
  location          GEOGRAPHY(POINT, 4326) NOT NULL,
  lat               DECIMAL(10, 7) NOT NULL,
  lng               DECIMAL(10, 7) NOT NULL,
  speed_kmh         DECIMAL(5, 1),
  heading           DECIMAL(5, 1), -- degrés 0-360
  accuracy          DECIMAL(6, 1), -- metres
  altitude          DECIMAL(7, 1),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Partition par mois pour performance
  created_at        TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (recorded_at);

-- Partition actuelle (à automatiser via pg_cron)
CREATE TABLE gps_locations_2025_01 PARTITION OF gps_locations
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE gps_locations_2025_06 PARTITION OF gps_locations
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE gps_locations_default PARTITION OF gps_locations DEFAULT;

CREATE INDEX idx_gps_trip ON gps_locations(trip_id);
CREATE INDEX idx_gps_vehicle ON gps_locations(vehicle_id);
CREATE INDEX idx_gps_time ON gps_locations(recorded_at DESC);
CREATE INDEX idx_gps_location ON gps_locations USING GIST(location);

-- ============================================================
-- TABLE: attendance (présence des élèves)
-- ============================================================

CREATE TABLE attendance (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id           UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(id),
  stop_id           UUID REFERENCES stops(id),
  driver_id         UUID REFERENCES drivers(id),
  org_id            UUID NOT NULL REFERENCES organisations(id),

  status            attendance_status NOT NULL,
  scanned_at        TIMESTAMPTZ DEFAULT NOW(),
  location          GEOGRAPHY(POINT, 4326),
  photo_url         TEXT, -- photo de confirmation si configuré
  notes             TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, student_id, status)
);

CREATE INDEX idx_att_trip ON attendance(trip_id);
CREATE INDEX idx_att_student ON attendance(student_id);
CREATE INDEX idx_att_driver ON attendance(driver_id);
CREATE INDEX idx_att_date ON attendance(scanned_at);

-- ============================================================
-- TABLE: notifications
-- ============================================================

CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organisations(id),
  recipient_id      UUID NOT NULL REFERENCES profiles(id),
  student_id        UUID REFERENCES students(id),
  trip_id           UUID REFERENCES trips(id),

  type              notification_type NOT NULL,
  channel           notification_channel NOT NULL,
  status            notification_status DEFAULT 'pending',

  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  data              JSONB DEFAULT '{}', -- metadata additionnelle

  -- Livraison
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  failed_at         TIMESTAMPTZ,
  failure_reason    TEXT,

  -- IDs externes
  twilio_sid        TEXT,
  firebase_id       TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notif_trip ON notifications(trip_id);
CREATE INDEX idx_notif_status ON notifications(status);
CREATE INDEX idx_notif_org ON notifications(org_id);

-- ============================================================
-- TABLE: messages (messagerie bidirectionnelle)
-- ============================================================

CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organisations(id),
  conversation_id   UUID NOT NULL, -- grouper les messages
  sender_id         UUID NOT NULL REFERENCES profiles(id),
  recipient_id      UUID REFERENCES profiles(id), -- null = broadcast
  trip_id           UUID REFERENCES trips(id),

  body              TEXT NOT NULL,
  is_broadcast      BOOLEAN DEFAULT false,
  status            message_status DEFAULT 'sent',

  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_msg_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_msg_sender ON messages(sender_id);
CREATE INDEX idx_msg_recipient ON messages(recipient_id);
CREATE INDEX idx_msg_trip ON messages(trip_id);

-- ============================================================
-- TABLE: vehicle_inspections
-- ============================================================

CREATE TABLE vehicle_inspections (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id        UUID NOT NULL REFERENCES vehicles(id),
  driver_id         UUID NOT NULL REFERENCES drivers(id),
  org_id            UUID NOT NULL REFERENCES organisations(id),
  trip_id           UUID REFERENCES trips(id),

  inspection_type   TEXT DEFAULT 'pre_trip', -- pre_trip, post_trip
  overall_status    TEXT DEFAULT 'pass',
  items             JSONB NOT NULL DEFAULT '[]', -- [{name, status, notes}]
  notes             TEXT,
  completed_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insp_vehicle ON vehicle_inspections(vehicle_id);
CREATE INDEX idx_insp_driver ON vehicle_inspections(driver_id);
CREATE INDEX idx_insp_date ON vehicle_inspections(completed_at DESC);

-- ============================================================
-- TABLE: audit_logs (conformité PIPEDA/GDPR)
-- ============================================================

CREATE TABLE audit_logs (
  id                BIGSERIAL PRIMARY KEY,
  org_id            UUID REFERENCES organisations(id),
  user_id           UUID REFERENCES profiles(id),
  action            TEXT NOT NULL, -- create, read, update, delete
  resource_type     TEXT NOT NULL, -- nom de la table
  resource_id       TEXT,
  old_values        JSONB,
  new_values        JSONB,
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ============================================================
-- FONCTION: updated_at automatique
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
CREATE TRIGGER trg_organisations_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_schools_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FONCTION: audit automatique
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  audit_org_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs(action, resource_type, resource_id, old_values)
    VALUES (TG_OP, TG_TABLE_NAME, OLD.id::TEXT, row_to_json(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs(action, resource_type, resource_id, old_values, new_values)
    VALUES (TG_OP, TG_TABLE_NAME, NEW.id::TEXT, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs(action, resource_type, resource_id, new_values)
    VALUES (TG_OP, TG_TABLE_NAME, NEW.id::TEXT, row_to_json(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit sur les tables sensibles
CREATE TRIGGER audit_students AFTER INSERT OR UPDATE OR DELETE ON students FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON profiles FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_drivers AFTER INSERT OR UPDATE OR DELETE ON drivers FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================
-- FONCTION: créer profil automatiquement à l'inscription
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles(id, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'parent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Fonction helper: org_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Fonction helper: rôle de l'utilisateur courant
CREATE OR REPLACE FUNCTION auth_role() RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Fonction helper: est super_admin?
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Politique: organisations
CREATE POLICY "Super admins voient tout" ON organisations FOR ALL USING (is_super_admin());
CREATE POLICY "Membres voient leur org" ON organisations FOR SELECT USING (id = auth_org_id());
CREATE POLICY "Org admins modifient leur org" ON organisations FOR UPDATE USING (id = auth_org_id() AND auth_role() = 'org_admin');

-- Politique: profiles
CREATE POLICY "Propre profil" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "Même org" ON profiles FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "Super admin" ON profiles FOR ALL USING (is_super_admin());

-- Politique: élèves (parents voient uniquement leurs enfants)
CREATE POLICY "Org members voient élèves" ON students FOR SELECT USING (
  org_id = auth_org_id() AND (
    auth_role() IN ('org_admin', 'dispatcher', 'driver', 'school_admin') OR
    EXISTS(SELECT 1 FROM parent_students ps WHERE ps.student_id = students.id AND ps.parent_id = auth.uid())
  )
);
CREATE POLICY "Staff modifie élèves" ON students FOR ALL USING (
  org_id = auth_org_id() AND auth_role() IN ('org_admin', 'dispatcher')
);

-- Politique: GPS (parents voient uniquement trajets de leurs enfants)
CREATE POLICY "GPS pour staff org" ON gps_locations FOR SELECT USING (
  EXISTS(SELECT 1 FROM trips t WHERE t.id = gps_locations.trip_id AND t.org_id = auth_org_id())
  AND auth_role() IN ('org_admin', 'dispatcher', 'driver')
);
CREATE POLICY "GPS insert chauffeur" ON gps_locations FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM trips t
    JOIN route_assignments ra ON ra.route_id = t.route_id
    JOIN drivers d ON d.id = ra.driver_id
    WHERE t.id = gps_locations.trip_id AND d.profile_id = auth.uid())
);

-- Politique: notifications (chacun voit les siennes)
CREATE POLICY "Mes notifications" ON notifications FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "Staff crée notifications" ON notifications FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_role() IN ('org_admin', 'dispatcher')
);

-- Politique: messages
CREATE POLICY "Mes messages" ON messages FOR SELECT USING (
  sender_id = auth.uid() OR recipient_id = auth.uid() OR
  (is_broadcast AND org_id = auth_org_id())
);
CREATE POLICY "Envoyer message" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Politique: trajets
CREATE POLICY "Trajets org" ON trips FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "Staff modifie trajets" ON trips FOR ALL USING (
  org_id = auth_org_id() AND auth_role() IN ('org_admin', 'dispatcher', 'driver')
);

-- ============================================================
-- VUES UTILES
-- ============================================================

-- Vue: statut des véhicules actifs avec dernière position
CREATE OR REPLACE VIEW active_vehicle_status AS
SELECT
  v.id AS vehicle_id,
  v.name AS vehicle_name,
  v.plate_number,
  t.id AS trip_id,
  t.status AS trip_status,
  t.delay_minutes,
  d.id AS driver_id,
  p.first_name || ' ' || p.last_name AS driver_name,
  gl.lat,
  gl.lng,
  gl.speed_kmh,
  gl.recorded_at AS last_update,
  t.org_id
FROM vehicles v
LEFT JOIN trips t ON t.vehicle_id = v.id AND t.trip_date = CURRENT_DATE AND t.status NOT IN ('completed', 'cancelled')
LEFT JOIN drivers d ON d.id = t.driver_id
LEFT JOIN profiles p ON p.id = d.profile_id
LEFT JOIN LATERAL (
  SELECT lat, lng, speed_kmh, recorded_at
  FROM gps_locations gl2
  WHERE gl2.vehicle_id = v.id
  ORDER BY gl2.recorded_at DESC
  LIMIT 1
) gl ON true;

-- Vue: tableau de bord parent
CREATE OR REPLACE VIEW parent_dashboard AS
SELECT
  ps.parent_id,
  s.id AS student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  s.photo_url,
  t.id AS trip_id,
  t.status AS trip_status,
  t.delay_minutes,
  t.estimated_end,
  v.name AS vehicle_name,
  p.first_name || ' ' || p.last_name AS driver_name,
  a.status AS attendance_status,
  a.scanned_at AS boarded_at
FROM parent_students ps
JOIN students s ON s.id = ps.student_id
LEFT JOIN student_stops ss ON ss.student_id = s.id
LEFT JOIN trips t ON t.route_id = ss.route_id AND t.trip_date = CURRENT_DATE
LEFT JOIN vehicles v ON v.id = t.vehicle_id
LEFT JOIN drivers d ON d.id = t.driver_id
LEFT JOIN profiles p ON p.id = d.profile_id
LEFT JOIN attendance a ON a.trip_id = t.id AND a.student_id = s.id;

-- ============================================================
-- DONNÉES DE RÉFÉRENCE
-- ============================================================

-- Organisation de démonstration
INSERT INTO organisations(id, name, slug, city, province, timezone, locale)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Transport Scolaire Démo',
  'demo',
  'Montréal',
  'QC',
  'America/Toronto',
  'fr'
);
