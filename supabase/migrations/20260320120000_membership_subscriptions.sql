-- Track membership offerings and renewal for cron-based billing
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES venue_offerings(id);
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS last_charged_at timestamptz;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS charge_method text DEFAULT 'wallet'; -- 'wallet' or 'card'
CREATE INDEX IF NOT EXISTS idx_memberships_expires ON memberships (expires_at) WHERE expires_at IS NOT NULL;
