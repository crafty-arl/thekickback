-- ============================================
-- Expanded Offering Model + AI Checkout Cards
-- Unified POS: any venue type can sell anything
-- ============================================

-- ─── Expand offering types ───────────────────────────────────────

ALTER TABLE venue_offerings DROP CONSTRAINT IF EXISTS venue_offerings_type_check;
ALTER TABLE venue_offerings ADD CONSTRAINT venue_offerings_type_check
  CHECK (type IN (
    'membership',      -- recurring access/status
    'reservation',     -- time-slotted space (booth, table, room, desk)
    'service',         -- priced service with duration (haircut, class, session)
    'product',         -- physical good (coffee, vinyl, merch)
    'event',           -- ticketed experience
    'package',         -- bundle of multiple offerings
    'custom'           -- catch-all
  ));

-- ─── New columns for richer offerings ────────────────────────────

ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS duration_minutes integer;
-- For services/reservations: how long does this last?

ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS capacity integer;
-- Max people per slot/class/event (null = unlimited)

ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS add_ons jsonb DEFAULT '[]'::jsonb;
-- Upsells the AI can suggest: [{"name":"Bottle Service","price_cents":12000},...]

ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS category text;
-- Sub-category for AI context: "haircut", "cocktail", "desk", "yoga", etc.

ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS image_url text;
-- Product/offering image

-- ─── Availability slots (time-based booking) ─────────────────────

CREATE TABLE IF NOT EXISTS offering_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid REFERENCES venue_offerings(id) ON DELETE CASCADE NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer DEFAULT 1,
  booked integer DEFAULT 0,
  status text DEFAULT 'available' CHECK (status IN ('available', 'full', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE offering_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available slots"
  ON offering_slots FOR SELECT
  USING (status = 'available');

CREATE POLICY "Service can manage slots"
  ON offering_slots FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_offering_slots_offering ON offering_slots(offering_id, starts_at);
CREATE INDEX idx_offering_slots_venue ON offering_slots(venue_id, starts_at);

-- ─── Orders (AI-generated checkout cards) ────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN (
    'pending',       -- AI generated card, user hasn't paid
    'confirmed',     -- user confirmed / paid
    'fulfilled',     -- venue marked complete
    'cancelled',     -- user or venue cancelled
    'expired'        -- timed out
  )),
  total_cents integer NOT NULL DEFAULT 0,
  points_discount_cents integer DEFAULT 0,
  points_spent integer DEFAULT 0,
  stripe_payment_id text,
  notes text,         -- AI-generated summary of what was ordered
  expires_at timestamptz DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  fulfilled_at timestamptz
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (user_id = (
    SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')
  ));

CREATE POLICY "Service can manage orders"
  ON orders FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_venue ON orders(venue_id, created_at DESC);

-- ─── Order Items (line items in a checkout card) ─────────────────

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  offering_id uuid REFERENCES venue_offerings(id) ON DELETE SET NULL,
  slot_id uuid REFERENCES offering_slots(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  quantity integer DEFAULT 1,
  unit_price_cents integer NOT NULL,
  total_cents integer NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
  -- e.g. {"date":"2026-03-20","time":"9:00 PM","guests":4,"add_ons":["Bottle Service"]}
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM orders WHERE user_id = (
      SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')
    )
  ));

CREATE POLICY "Service can manage order_items"
  ON order_items FOR ALL
  USING (true) WITH CHECK (true);

-- ─── Update point_ledger reasons ─────────────────────────────────

ALTER TABLE point_ledger DROP CONSTRAINT IF EXISTS point_ledger_reason_check;
ALTER TABLE point_ledger ADD CONSTRAINT point_ledger_reason_check
  CHECK (reason IN (
    'first_visit', 'return_visit', 'session_complete',
    'ai_interaction', 'request_made', 'membership_joined',
    'referral', 'challenge_complete', 'multiplier_bonus',
    'venue_bonus', 'perk_redeem', 'streak_bonus',
    'vibe_drop', 'photo_drop', 'discovery_scout',
    'purchase_bonus'
  ));

-- ─── Function: Create order from AI checkout card ────────────────

CREATE OR REPLACE FUNCTION create_order(
  p_user_id uuid,
  p_venue_id uuid,
  p_items jsonb,  -- [{"offering_id":"...","slot_id":null,"name":"Booth 7","quantity":1,"unit_price_cents":5000,"metadata":{}}]
  p_points_to_spend integer DEFAULT 0,
  p_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  item RECORD;
  total integer := 0;
  points_discount integer := 0;
  user_balance integer;
  new_order_id uuid;
BEGIN
  -- Calculate total
  FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    offering_id uuid, slot_id uuid, name text,
    description text, quantity integer, unit_price_cents integer, metadata jsonb
  ) LOOP
    total := total + (item.unit_price_cents * COALESCE(item.quantity, 1));
  END LOOP;

  -- Handle points discount (100 points = $1)
  IF p_points_to_spend > 0 THEN
    SELECT balance INTO user_balance FROM point_balances WHERE user_id = p_user_id;
    IF user_balance IS NULL OR user_balance < p_points_to_spend THEN
      RAISE EXCEPTION 'Insufficient points';
    END IF;
    points_discount := p_points_to_spend; -- 1 point = 1 cent
    IF points_discount > total THEN
      points_discount := total;
    END IF;
  END IF;

  -- Create order
  INSERT INTO orders (user_id, venue_id, total_cents, points_discount_cents, points_spent, notes)
  VALUES (p_user_id, p_venue_id, total - points_discount, points_discount, p_points_to_spend, p_notes)
  RETURNING id INTO new_order_id;

  -- Create line items
  FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    offering_id uuid, slot_id uuid, name text,
    description text, quantity integer, unit_price_cents integer, metadata jsonb
  ) LOOP
    INSERT INTO order_items (order_id, offering_id, slot_id, name, description, quantity, unit_price_cents, total_cents, metadata)
    VALUES (
      new_order_id, item.offering_id, item.slot_id, item.name, item.description,
      COALESCE(item.quantity, 1), item.unit_price_cents,
      item.unit_price_cents * COALESCE(item.quantity, 1), COALESCE(item.metadata, '{}'::jsonb)
    );

    -- Book slot if applicable
    IF item.slot_id IS NOT NULL THEN
      UPDATE offering_slots
      SET booked = booked + COALESCE(item.quantity, 1)
      WHERE id = item.slot_id AND booked + COALESCE(item.quantity, 1) <= capacity;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Slot is full';
      END IF;

      UPDATE offering_slots SET status = 'full'
      WHERE id = item.slot_id AND booked >= capacity;
    END IF;
  END LOOP;

  -- Deduct points if used
  IF p_points_to_spend > 0 THEN
    PERFORM grant_points(p_user_id, p_venue_id, -p_points_to_spend, 'perk_redeem', new_order_id);
  END IF;

  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Migrate existing offering types ─────────────────────────────
-- Rename old types to new ones

UPDATE venue_offerings SET type = 'reservation' WHERE type = 'booth_hold';
UPDATE venue_offerings SET type = 'reservation' WHERE type = 'space_rental';
UPDATE venue_offerings SET type = 'event' WHERE type = 'event_ticket';
