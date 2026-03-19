-- ============================================
-- Venue Offerings (memberships, booth holds, space rentals, etc.)
-- Stripe-ready: stripe_price_id stays null until connected
-- ============================================

CREATE TABLE IF NOT EXISTS venue_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('membership', 'booth_hold', 'space_rental', 'event_ticket', 'custom')),
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  recurring boolean DEFAULT false,
  interval text CHECK (interval IN ('month', 'year')),
  perks jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  stripe_price_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE venue_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active offerings"
  ON venue_offerings FOR SELECT
  USING (active = true);

CREATE POLICY "Service can manage offerings"
  ON venue_offerings FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Ensure venue columns exist for address/location
-- (may already exist from onboarding migration)
-- ============================================

DO $$ BEGIN
  ALTER TABLE venues ADD COLUMN IF NOT EXISTS address text;
  ALTER TABLE venues ADD COLUMN IF NOT EXISTS neighborhood text;
  ALTER TABLE venues ADD COLUMN IF NOT EXISTS lat double precision;
  ALTER TABLE venues ADD COLUMN IF NOT EXISTS lng double precision;
  ALTER TABLE venues ADD COLUMN IF NOT EXISTS type text DEFAULT 'venue';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
