-- ============================================
-- theKickBack Database Schema
-- Phone number = identity
-- ============================================

-- Profiles (linked to Supabase Auth via phone)
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (phone = (SELECT auth.jwt() ->> 'phone'));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (phone = (SELECT auth.jwt() ->> 'phone'));

-- Auto-create profile on first SMS (service role insert)
CREATE POLICY "Service can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Venues
-- ============================================

CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state text DEFAULT 'active' CHECK (state IN ('active', 'inactive', 'closed')),
  occupancy integer DEFAULT 0,
  max_occupancy integer DEFAULT 100,
  vibe text DEFAULT 'quiet' CHECK (vibe IN ('quiet', 'moderate', 'busy', 'packed')),
  rules jsonb DEFAULT '[]'::jsonb,
  phone text,
  twilio_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view venues"
  ON venues FOR SELECT
  USING (true);

-- ============================================
-- Sessions (user visits to venues)
-- ============================================

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired'))
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT
  USING (user_id = (
    SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')
  ));

CREATE POLICY "Service can manage sessions"
  ON sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Memberships
-- ============================================

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  tier text DEFAULT 'basic' CHECK (tier IN ('basic', 'member', 'vip')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (user_id, venue_id)
);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memberships"
  ON memberships FOR SELECT
  USING (user_id = (
    SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')
  ));

CREATE POLICY "Service can manage memberships"
  ON memberships FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Requests (booth holds, orders, etc.)
-- ============================================

CREATE TABLE requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('booth', 'order', 'service', 'other')),
  body text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON requests FOR SELECT
  USING (user_id = (
    SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')
  ));

CREATE POLICY "Service can manage requests"
  ON requests FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Seed: Demo venue
-- ============================================

INSERT INTO venues (name, state, occupancy, max_occupancy, vibe, rules) VALUES
  ('The Rooftop', 'active', 12, 50, 'quiet', '["Quiet after 6 PM", "Members get priority booth access", "Free Wi-Fi for all guests"]'::jsonb),
  ('Daily Grind', 'active', 24, 40, 'busy', '["Laptop-friendly", "No phone calls at communal tables"]'::jsonb),
  ('The Loft', 'active', 8, 30, 'quiet', '["Members only after 9 PM", "BYOB Thursdays"]'::jsonb);
