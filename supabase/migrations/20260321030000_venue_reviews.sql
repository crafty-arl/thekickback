-- Venue reviews — one per user per venue, 1-5 stars + optional text
CREATE TABLE IF NOT EXISTS venue_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body text,
  source text DEFAULT 'app' CHECK (source IN ('app', 'chat', 'email')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, venue_id)
);
CREATE INDEX IF NOT EXISTS idx_venue_reviews_venue ON venue_reviews(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_reviews_user ON venue_reviews(user_id);
