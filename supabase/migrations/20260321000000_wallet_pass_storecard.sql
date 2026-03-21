-- Wallet pass refactor: one pass per user, storeCard type
-- Add state tracking columns
ALTER TABLE wallet_passes ADD COLUMN IF NOT EXISTS pass_state text DEFAULT 'idle';
ALTER TABLE wallet_passes ADD COLUMN IF NOT EXISTS active_venue_id uuid;
ALTER TABLE wallet_passes ADD COLUMN IF NOT EXISTS hmac_secret text;

-- Pending fulfillments: items bought on KickBack waiting to be fulfilled at venue
CREATE TABLE IF NOT EXISTS pending_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('order', 'booking', 'redemption')),
  reference_id text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz DEFAULT now(),
  fulfilled_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pending_fulfillments_user ON pending_fulfillments(user_id) WHERE fulfilled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pending_fulfillments_venue ON pending_fulfillments(venue_id) WHERE fulfilled_at IS NULL;
