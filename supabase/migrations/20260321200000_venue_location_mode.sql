-- Hub location modes: fixed (permanent address), mobile (moves around), virtual (no physical location)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS location_mode text NOT NULL DEFAULT 'fixed';

-- Index for filtering virtual/mobile hubs that only show via event pins
CREATE INDEX IF NOT EXISTS idx_venues_location_mode ON venues (location_mode) WHERE location_mode != 'fixed';
