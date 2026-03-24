-- Add sandbox mode isolation to venues
-- All child tables (offerings, pages, knowledge, etc.) are filtered via venue_id
ALTER TABLE venues ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';
CREATE INDEX IF NOT EXISTS idx_venues_mode ON venues (mode);
