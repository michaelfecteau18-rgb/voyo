-- ============================================================
-- VOYO — Migration 002
-- Optimisations performance, fonctions RPC, Realtime
-- ============================================================

-- ============================================================
-- INDEX ADDITIONNELS (après analyse EXPLAIN)
-- ============================================================

-- GPS: requêtes fréquentes par véhicule + temps récent
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_vehicle_recent
  ON gps_locations(vehicle_id, recorded_at DESC);

-- Trajets: recherche par date + org très fréquente
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_org_date_status
  ON trips(org_id, trip_date, status);

-- Notifications: non lues par destinataire
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_unread
  ON notifications(recipient_id, read_at)
  WHERE read_at IS NULL;

-- Attendance: par trip + statut
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_trip_status
  ON attendance(trip_id, status);

-- Messages: conversation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conv_time
  ON messages(conversation_id, created_at DESC);

-- ============================================================
-- FONCTIONS RPC (appelables depuis le client)
-- ============================================================

-- Statistiques de la plateforme (super admin)
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_orgs',     (SELECT COUNT(*) FROM organisations),
    'active_orgs',    (SELECT COUNT(*) FROM organisations WHERE is_active),
    'total_vehicles', (SELECT COUNT(*) FROM vehicles WHERE status = 'active'),
    'total_students', (SELECT COUNT(*) FROM students WHERE is_active),
    'trips_today',    (SELECT COUNT(*) FROM trips WHERE trip_date = CURRENT_DATE),
    'active_now',     (SELECT COUNT(*) FROM trips WHERE trip_date = CURRENT_DATE AND status = 'en_route')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Statistiques d'une organisation
CREATE OR REPLACE FUNCTION get_org_stats(p_org_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'vehicles_active', (
      SELECT COUNT(*) FROM vehicles
      WHERE org_id = p_org_id AND status = 'active'
    ),
    'students_active', (
      SELECT COUNT(*) FROM students
      WHERE org_id = p_org_id AND is_active
    ),
    'trips_today', (
      SELECT COUNT(*) FROM trips
      WHERE org_id = p_org_id AND trip_date = CURRENT_DATE
    ),
    'on_time_rate_7d', (
      SELECT ROUND(
        COUNT(*) FILTER (WHERE delay_minutes <= 5)::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
      )
      FROM trips
      WHERE org_id = p_org_id
        AND trip_date >= CURRENT_DATE - 7
        AND status = 'completed'
    ),
    'students_transported_today', (
      SELECT COUNT(DISTINCT student_id)
      FROM attendance a
      JOIN trips t ON t.id = a.trip_id
      WHERE t.org_id = p_org_id
        AND t.trip_date = CURRENT_DATE
        AND a.status IN ('boarded', 'present_at_school')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Marquer toutes les notifications comme lues
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET read_at = NOW(), status = 'read'
  WHERE recipient_id = p_user_id
    AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtenir la dernière position GPS d'un véhicule
CREATE OR REPLACE FUNCTION get_latest_vehicle_position(p_vehicle_id UUID)
RETURNS TABLE(lat DECIMAL, lng DECIMAL, speed_kmh DECIMAL, heading DECIMAL, recorded_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT gl.lat, gl.lng, gl.speed_kmh, gl.heading, gl.recorded_at
  FROM gps_locations gl
  WHERE gl.vehicle_id = p_vehicle_id
  ORDER BY gl.recorded_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Historique de trajet pour playback
CREATE OR REPLACE FUNCTION get_trip_path(p_trip_id UUID)
RETURNS TABLE(lat DECIMAL, lng DECIMAL, speed_kmh DECIMAL, heading DECIMAL, recorded_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT gl.lat, gl.lng, gl.speed_kmh, gl.heading, gl.recorded_at
  FROM gps_locations gl
  WHERE gl.trip_id = p_trip_id
  ORDER BY gl.recorded_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PUBLICATION REALTIME (tables à activer)
-- ============================================================

-- Créer la publication si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Ajouter les tables au canal Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE gps_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE trips;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_stops;

-- ============================================================
-- MAINTENANCE AUTOMATIQUE (pg_cron)
-- ============================================================

-- Créer partitions GPS chaque mois (à adapter selon le calendrier)
SELECT cron.schedule(
  'create-gps-partition',
  '0 0 25 * *', -- Le 25 de chaque mois
  $$
  DO $$
  DECLARE
    next_month DATE := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    partition_name TEXT := 'gps_locations_' || TO_CHAR(next_month, 'YYYY_MM');
    start_date TEXT := TO_CHAR(next_month, 'YYYY-MM-DD');
    end_date TEXT := TO_CHAR(next_month + INTERVAL '1 month', 'YYYY-MM-DD');
  BEGIN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF gps_locations FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
  END $$;
  $$
);

-- Nettoyer les vieilles positions GPS (garder 90 jours)
SELECT cron.schedule(
  'cleanup-old-gps',
  '0 3 * * 0', -- Chaque dimanche à 3h
  $$
  DELETE FROM gps_locations WHERE recorded_at < NOW() - INTERVAL '90 days';
  $$
);

-- Nettoyer les notifications lues de plus de 30 jours
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 4 * * 0',
  $$
  DELETE FROM notifications
  WHERE read_at IS NOT NULL
    AND read_at < NOW() - INTERVAL '30 days';
  $$
);

-- ============================================================
-- TRIGGER: Mettre à jour le compteur d'arrêts d'une route
-- ============================================================

CREATE OR REPLACE FUNCTION update_route_stop_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE routes
    SET total_stops = (
      SELECT COUNT(*) FROM stops WHERE route_id = NEW.route_id AND is_active = true
    )
    WHERE id = NEW.route_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE routes
    SET total_stops = (
      SELECT COUNT(*) FROM stops WHERE route_id = OLD.route_id AND is_active = true
    )
    WHERE id = OLD.route_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stop_count
  AFTER INSERT OR UPDATE OR DELETE ON stops
  FOR EACH ROW EXECUTE FUNCTION update_route_stop_count();

-- ============================================================
-- VUE: Tableau de bord répartiteur amélioré
-- ============================================================

CREATE OR REPLACE VIEW dispatcher_overview AS
SELECT
  t.id AS trip_id,
  t.trip_date,
  t.status,
  t.delay_minutes,
  t.students_total,
  t.students_boarded,
  t.students_absent,
  t.scheduled_start,
  t.estimated_end,
  r.name AS route_name,
  r.route_type,
  r.color AS route_color,
  v.id AS vehicle_id,
  v.name AS vehicle_name,
  v.plate_number,
  p.first_name || ' ' || p.last_name AS driver_name,
  p2.phone AS driver_phone,
  gl.lat AS current_lat,
  gl.lng AS current_lng,
  gl.speed_kmh,
  gl.recorded_at AS last_gps_update,
  t.org_id
FROM trips t
JOIN routes r ON r.id = t.route_id
LEFT JOIN vehicles v ON v.id = t.vehicle_id
LEFT JOIN drivers d ON d.id = t.driver_id
LEFT JOIN profiles p ON p.id = d.profile_id
LEFT JOIN profiles p2 ON p2.id = d.profile_id
LEFT JOIN LATERAL (
  SELECT lat, lng, speed_kmh, recorded_at
  FROM gps_locations
  WHERE vehicle_id = t.vehicle_id
  ORDER BY recorded_at DESC
  LIMIT 1
) gl ON true
WHERE t.trip_date = CURRENT_DATE;

-- ============================================================
-- SÉCURITÉ: Bloquer les requêtes sans org_id
-- ============================================================

-- Fonction de sécurité: valider que l'org_id correspond
CREATE OR REPLACE FUNCTION validate_org_access(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_org_id = auth_org_id() OR is_super_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
