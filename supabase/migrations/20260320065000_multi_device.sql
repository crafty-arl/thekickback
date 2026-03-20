-- ╔═══════════════════════════════════════════════════════════╗
-- ║  Multi-device support — up to 3 devices per account     ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Track devices per user (max 3)
CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_name text, -- e.g. "iPhone Safari", "Chrome on Mac"
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device ON user_devices (device_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_user_device ON user_devices (user_id, device_id);

-- RLS
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices" ON user_devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage devices" ON user_devices
  FOR ALL USING (true) WITH CHECK (true);
