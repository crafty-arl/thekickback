-- POS sync fields on venue_offerings
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS pos_provider text;
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS pos_item_id text;
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS ai_visible boolean DEFAULT true;
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- Index for finding synced items
CREATE INDEX IF NOT EXISTS idx_offerings_pos ON venue_offerings (venue_id, pos_provider) WHERE pos_provider IS NOT NULL;

-- POS connection state on venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS pos_provider text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS pos_connected_at timestamptz;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS apideck_consumer_id text;
