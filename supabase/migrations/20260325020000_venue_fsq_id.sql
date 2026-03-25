-- Track Foursquare place ID on venues for dedup of discovered places
ALTER TABLE venues ADD COLUMN IF NOT EXISTS fsq_place_id text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_venues_fsq ON venues (fsq_place_id) WHERE fsq_place_id IS NOT NULL;
