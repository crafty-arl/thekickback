-- User-configurable discovery radius (meters), default 5km
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discovery_radius_meters integer DEFAULT 5000;
