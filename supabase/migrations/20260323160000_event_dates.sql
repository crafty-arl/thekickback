-- Add event date fields to venue_offerings
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS ends_at timestamptz;

-- Index for querying upcoming events
CREATE INDEX IF NOT EXISTS idx_offerings_event_dates ON venue_offerings (venue_id, starts_at) WHERE type = 'event' AND starts_at IS NOT NULL;
