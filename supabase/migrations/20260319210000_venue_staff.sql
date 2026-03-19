-- ============================================
-- Venue Staff (public-facing staff profiles)
-- Phase 1: Staff visibility on venue pages
-- ============================================

CREATE TABLE venue_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  role_title text,            -- "Lead Barista", "Resident DJ", "Senior Stylist"
  avatar_url text,            -- Staff headshot
  bio text,                   -- Short bio shown on venue page
  specialties text[] DEFAULT '{}',  -- Tags: ["Fade", "Lineup", "Color"]
  visible boolean DEFAULT true,     -- Toggle visibility on public page
  sort_order integer DEFAULT 0,
  schedule jsonb DEFAULT '[]'::jsonb,  -- [{day: "Mon", start: "9:00", end: "17:00"}]
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE venue_staff ENABLE ROW LEVEL SECURITY;

-- Anyone can see visible staff
CREATE POLICY "Anyone can view visible staff"
  ON venue_staff FOR SELECT
  USING (visible = true);

-- Service role can manage all staff
CREATE POLICY "Service can manage staff"
  ON venue_staff FOR ALL
  USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_venue_staff_venue ON venue_staff(venue_id, sort_order);

-- ============================================
-- Staff ↔ Offerings junction (Phase 2 prep)
-- Which staff members can provide which services
-- ============================================

CREATE TABLE staff_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES venue_staff(id) ON DELETE CASCADE NOT NULL,
  offering_id uuid REFERENCES venue_offerings(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (staff_id, offering_id)
);

ALTER TABLE staff_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view staff offerings"
  ON staff_offerings FOR SELECT
  USING (true);

CREATE POLICY "Service can manage staff offerings"
  ON staff_offerings FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================
-- Add staff_id to offering_slots (Phase 3 prep)
-- Assigns a time slot to a specific staff member
-- ============================================

ALTER TABLE offering_slots ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES venue_staff(id) ON DELETE SET NULL;

-- ============================================
-- Add staff_id to order_items (Phase 3 prep)
-- Records which staff fulfilled the booking
-- ============================================

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES venue_staff(id) ON DELETE SET NULL;
