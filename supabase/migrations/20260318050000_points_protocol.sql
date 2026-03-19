-- ============================================
-- Points Protocol — Creator Economy for Venues
-- Universal points earned at any venue, spent at any venue.
-- ============================================

-- ─── Point Ledger (immutable append-only log) ────────────────────

CREATE TABLE point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  amount integer NOT NULL, -- positive = earned, negative = spent
  reason text NOT NULL CHECK (reason IN (
    'first_visit', 'return_visit', 'session_complete',
    'ai_interaction', 'request_made', 'membership_joined',
    'referral', 'challenge_complete', 'multiplier_bonus',
    'venue_bonus', 'perk_redeem', 'streak_bonus'
  )),
  reference_id uuid, -- links to session/request/membership/perk_redemption
  created_at timestamptz DEFAULT now()
);

ALTER TABLE point_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points"
  ON point_ledger FOR SELECT
  USING (user_id = (
    SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')
  ));

CREATE POLICY "Service can manage point_ledger"
  ON point_ledger FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_point_ledger_user ON point_ledger(user_id);
CREATE INDEX idx_point_ledger_venue ON point_ledger(venue_id);
CREATE INDEX idx_point_ledger_created ON point_ledger(created_at DESC);

-- ─── Point Balances (running totals per user) ────────────────────

CREATE TABLE point_balances (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_earned integer DEFAULT 0,
  total_spent integer DEFAULT 0,
  balance integer DEFAULT 0,
  tier text DEFAULT 'explorer' CHECK (tier IN ('explorer', 'regular', 'member', 'vip')),
  venues_visited integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_visit_week text, -- '2026-W12'
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE point_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balance"
  ON point_balances FOR SELECT
  USING (user_id = (
    SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')
  ));

CREATE POLICY "Service can manage point_balances"
  ON point_balances FOR ALL
  USING (true) WITH CHECK (true);

-- ─── Venue Perks (what venues offer for points) ─────────────────

CREATE TABLE venue_perks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  point_cost integer NOT NULL CHECK (point_cost > 0),
  category text DEFAULT 'other' CHECK (category IN (
    'drink', 'food', 'access', 'experience', 'merch', 'other'
  )),
  inventory integer, -- null = unlimited
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE venue_perks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active perks"
  ON venue_perks FOR SELECT
  USING (active = true);

CREATE POLICY "Service can manage venue_perks"
  ON venue_perks FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_venue_perks_venue ON venue_perks(venue_id);

-- ─── Perk Redemptions (when users spend points) ─────────────────

CREATE TABLE perk_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  perk_id uuid REFERENCES venue_perks(id) ON DELETE CASCADE NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  points_spent integer NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'fulfilled', 'expired')),
  created_at timestamptz DEFAULT now(),
  fulfilled_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

ALTER TABLE perk_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions"
  ON perk_redemptions FOR SELECT
  USING (user_id = (
    SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')
  ));

CREATE POLICY "Service can manage perk_redemptions"
  ON perk_redemptions FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_perk_redemptions_user ON perk_redemptions(user_id);
CREATE INDEX idx_perk_redemptions_venue ON perk_redemptions(venue_id);

-- ─── Venue Multipliers (boost earning rates) ────────────────────

CREATE TABLE venue_multipliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  multiplier numeric(3,1) DEFAULT 2.0 CHECK (multiplier > 1.0 AND multiplier <= 5.0),
  reason text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE venue_multipliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active multipliers"
  ON venue_multipliers FOR SELECT
  USING (active = true);

CREATE POLICY "Service can manage venue_multipliers"
  ON venue_multipliers FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_venue_multipliers_venue ON venue_multipliers(venue_id);

-- ─── Challenges (cross-venue engagement) ─────────────────────────

CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  point_reward integer NOT NULL CHECK (point_reward > 0),
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- e.g. {"type":"multi_venue","count":3,"category":"cafe","window_days":7}
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active challenges"
  ON challenges FOR SELECT
  USING (active = true);

CREATE POLICY "Service can manage challenges"
  ON challenges FOR ALL
  USING (true) WITH CHECK (true);

-- ─── Challenge Progress ──────────────────────────────────────────

CREATE TABLE challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  progress jsonb DEFAULT '{}'::jsonb,
  -- e.g. {"venues_visited":["id1","id2"]}
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own challenge progress"
  ON challenge_progress FOR SELECT
  USING (user_id = (
    SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')
  ));

CREATE POLICY "Service can manage challenge_progress"
  ON challenge_progress FOR ALL
  USING (true) WITH CHECK (true);

-- ─── Function: Grant Points ──────────────────────────────────────
-- Call this from workers/API routes to atomically grant points
-- and update the running balance.

CREATE OR REPLACE FUNCTION grant_points(
  p_user_id uuid,
  p_venue_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id uuid DEFAULT NULL
) RETURNS integer AS $$
DECLARE
  final_amount integer;
  multiplier_val numeric;
  new_balance integer;
  new_tier text;
  new_total integer;
BEGIN
  final_amount := p_amount;

  -- Check for active venue multiplier (only for positive amounts)
  IF p_amount > 0 AND p_venue_id IS NOT NULL THEN
    SELECT m.multiplier INTO multiplier_val
    FROM venue_multipliers m
    WHERE m.venue_id = p_venue_id
      AND m.active = true
      AND now() BETWEEN m.starts_at AND m.ends_at
    ORDER BY m.multiplier DESC
    LIMIT 1;

    IF multiplier_val IS NOT NULL THEN
      final_amount := CEIL(p_amount * multiplier_val);

      -- Log the bonus separately
      INSERT INTO point_ledger (user_id, venue_id, amount, reason, reference_id)
      VALUES (p_user_id, p_venue_id, final_amount - p_amount, 'multiplier_bonus', p_reference_id);
    END IF;
  END IF;

  -- Insert ledger entry
  INSERT INTO point_ledger (user_id, venue_id, amount, reason, reference_id)
  VALUES (p_user_id, p_venue_id, p_amount, p_reason, p_reference_id);

  -- Upsert balance
  INSERT INTO point_balances (user_id, total_earned, total_spent, balance)
  VALUES (
    p_user_id,
    GREATEST(final_amount, 0),
    GREATEST(-final_amount, 0),
    final_amount
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_earned = point_balances.total_earned + GREATEST(final_amount, 0),
    total_spent  = point_balances.total_spent + GREATEST(-final_amount, 0),
    balance      = point_balances.balance + final_amount,
    updated_at   = now();

  -- Get updated balance for tier calculation
  SELECT pb.balance, pb.total_earned INTO new_balance, new_total
  FROM point_balances pb WHERE pb.user_id = p_user_id;

  -- Update tier based on total earned
  new_tier := CASE
    WHEN new_total >= 5000 THEN 'vip'
    WHEN new_total >= 1500 THEN 'member'
    WHEN new_total >= 500  THEN 'regular'
    ELSE 'explorer'
  END;

  UPDATE point_balances SET tier = new_tier WHERE user_id = p_user_id;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Function: Redeem Perk ───────────────────────────────────────

CREATE OR REPLACE FUNCTION redeem_perk(
  p_user_id uuid,
  p_perk_id uuid
) RETURNS uuid AS $$
DECLARE
  perk_record RECORD;
  user_balance integer;
  redemption_id uuid;
BEGIN
  -- Get perk details
  SELECT * INTO perk_record FROM venue_perks
  WHERE id = p_perk_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perk not found or inactive';
  END IF;

  -- Check inventory
  IF perk_record.inventory IS NOT NULL AND perk_record.inventory <= 0 THEN
    RAISE EXCEPTION 'Perk out of stock';
  END IF;

  -- Check user balance
  SELECT balance INTO user_balance FROM point_balances WHERE user_id = p_user_id;

  IF user_balance IS NULL OR user_balance < perk_record.point_cost THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;

  -- Create redemption
  INSERT INTO perk_redemptions (user_id, perk_id, venue_id, points_spent)
  VALUES (p_user_id, p_perk_id, perk_record.venue_id, perk_record.point_cost)
  RETURNING id INTO redemption_id;

  -- Deduct points
  PERFORM grant_points(p_user_id, perk_record.venue_id, -perk_record.point_cost, 'perk_redeem', redemption_id);

  -- Decrement inventory if tracked
  IF perk_record.inventory IS NOT NULL THEN
    UPDATE venue_perks SET inventory = inventory - 1 WHERE id = p_perk_id;
  END IF;

  RETURN redemption_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Seed: Demo perks for existing venues ────────────────────────

INSERT INTO venue_perks (venue_id, name, description, point_cost, category, sort_order)
SELECT v.id, p.name, p.description, p.cost, p.category, p.sort
FROM venues v
CROSS JOIN (VALUES
  ('The Rooftop', 'Free Drip Coffee', 'Any drip coffee, any size.', 100, 'drink', 1),
  ('The Rooftop', 'Priority Booth', 'Skip the wait — next booth is yours.', 250, 'access', 2),
  ('The Rooftop', 'Rooftop Burger', 'House burger on the house.', 400, 'food', 3),
  ('The Rooftop', 'Members-Only Hour', 'Access to members-only 9 PM hour.', 500, 'experience', 4),
  ('Daily Grind', 'Free Latte', 'Any latte, any milk.', 80, 'drink', 1),
  ('Daily Grind', 'Power Outlet Spot', 'Reserved spot next to an outlet.', 150, 'access', 2),
  ('Daily Grind', 'Pastry Box', 'Pick any 2 pastries.', 200, 'food', 3),
  ('The Loft', 'Free House Wine', 'Glass of house red or white.', 120, 'drink', 1),
  ('The Loft', 'VIP Corner', 'Best seat in the house for 2 hours.', 300, 'access', 2),
  ('The Loft', 'BYOB Thursday Pass', 'Bring your own bottle, no corkage.', 200, 'experience', 3)
) AS p(venue_name, name, description, cost, category, sort)
WHERE v.name = p.venue_name;

-- ─── Seed: Demo challenge ────────────────────────────────────────

INSERT INTO challenges (title, description, point_reward, criteria, starts_at, ends_at)
VALUES (
  'Third Place Explorer',
  'Visit 3 different venues this week. Any vibe, any time.',
  200,
  '{"type": "multi_venue", "count": 3, "window_days": 7}'::jsonb,
  now(),
  now() + interval '90 days'
);
