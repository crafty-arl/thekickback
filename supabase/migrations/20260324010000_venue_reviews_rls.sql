-- Add RLS to venue_reviews (was missing)
ALTER TABLE venue_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "Reviews are publicly readable"
  ON venue_reviews FOR SELECT
  USING (true);

-- Users can insert their own reviews
CREATE POLICY "Users can create their own reviews"
  ON venue_reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON venue_reviews FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY "Users can delete their own reviews"
  ON venue_reviews FOR DELETE
  USING (user_id = auth.uid());

-- Service role has full access
CREATE POLICY "Service role full access on reviews"
  ON venue_reviews FOR ALL
  USING (auth.role() = 'service_role');
