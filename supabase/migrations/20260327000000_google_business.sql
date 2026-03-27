-- Google Business Profile integration
ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_refresh_token text;
CREATE INDEX IF NOT EXISTS idx_venues_google ON venues (google_place_id) WHERE google_place_id IS NOT NULL;
