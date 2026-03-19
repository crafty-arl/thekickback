-- ╔═══════════════════════════════════════════════════════════╗
-- ║  One device per email — device fingerprint on profiles   ║
-- ╚═══════════════════════════════════════════════════════════╝

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS device_id text;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_device_id ON profiles (device_id) WHERE device_id IS NOT NULL;
