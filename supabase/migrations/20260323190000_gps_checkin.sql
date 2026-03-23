-- GPS Check-In: add location fields to sessions, geofence radius to venues, auto-expiry

-- Sessions: track how the user checked in and their location
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS check_in_method text DEFAULT 'qr';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_lat double precision;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_lng double precision;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS distance_meters double precision;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Venues: configurable check-in radius (meters)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS check_in_radius_meters integer DEFAULT 150;

-- Backfill: set expiry on existing active sessions
UPDATE sessions SET expires_at = started_at + interval '4 hours' WHERE expires_at IS NULL;

-- Hourly cleanup: expire stale sessions (requires pg_cron extension)
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('expire-sessions', '0 * * * *',
--   $$UPDATE sessions SET status = 'expired', ended_at = expires_at WHERE status = 'active' AND expires_at < now()$$
-- );
