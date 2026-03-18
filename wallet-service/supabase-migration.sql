-- Wallet passes: tracks each pass issued to a user for a venue
CREATE TABLE IF NOT EXISTS wallet_passes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number text UNIQUE NOT NULL,
  auth_token text NOT NULL,
  user_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  pass_type_id text NOT NULL DEFAULT 'pass.net.thekickback.venue',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Device registrations: Apple devices that have installed a pass
CREATE TABLE IF NOT EXISTS wallet_devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL,
  push_token text,
  pass_type_id text NOT NULL,
  serial_number text NOT NULL REFERENCES wallet_passes(serial_number) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(device_id, serial_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_passes_venue ON wallet_passes(venue_id);
CREATE INDEX IF NOT EXISTS idx_wallet_passes_user ON wallet_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_devices_serial ON wallet_devices(serial_number);
