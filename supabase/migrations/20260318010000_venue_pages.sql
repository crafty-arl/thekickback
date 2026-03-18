-- ============================================
-- Venue Pages (owner-customizable landing pages)
-- ============================================

CREATE TABLE venue_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL UNIQUE,
  slug text UNIQUE NOT NULL,
  hero_image text,
  logo text,
  tagline text,
  description text,
  theme_color text DEFAULT '#F97316',
  menu_sections jsonb DEFAULT '[]'::jsonb,
  hours jsonb DEFAULT '[]'::jsonb,
  social_links jsonb DEFAULT '{}'::jsonb,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE venue_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published pages"
  ON venue_pages FOR SELECT USING (published = true);

CREATE POLICY "Service can manage pages"
  ON venue_pages FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Venue Gallery
-- ============================================

CREATE TABLE venue_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  caption text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE venue_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view gallery"
  ON venue_gallery FOR SELECT USING (true);

CREATE POLICY "Service can manage gallery"
  ON venue_gallery FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Venue Owners (links users to venues they manage)
-- ============================================

CREATE TABLE venue_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, venue_id)
);

ALTER TABLE venue_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own venues"
  ON venue_owners FOR SELECT
  USING (user_id = (SELECT id FROM profiles WHERE phone = (SELECT auth.jwt() ->> 'phone')));

CREATE POLICY "Service can manage owners"
  ON venue_owners FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Chat Messages (persistent chat history)
-- ============================================

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  sender_phone text,
  sender_type text DEFAULT 'guest' CHECK (sender_type IN ('guest', 'venue', 'ai')),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat messages for a venue"
  ON chat_messages FOR SELECT USING (true);

CREATE POLICY "Service can manage chat"
  ON chat_messages FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- QR Codes
-- ============================================

CREATE TABLE qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  label text NOT NULL,
  context text,
  scans integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage QR codes"
  ON qr_codes FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Seed: Venue pages for demo venues
-- ============================================

INSERT INTO venue_pages (venue_id, slug, tagline, description, theme_color, published, menu_sections, hours)
SELECT
  v.id,
  CASE v.name
    WHEN 'The Rooftop' THEN 'the-rooftop'
    WHEN 'Daily Grind' THEN 'daily-grind'
    WHEN 'The Loft' THEN 'the-loft'
  END,
  CASE v.name
    WHEN 'The Rooftop' THEN 'A rooftop for people who pay attention'
    WHEN 'Daily Grind' THEN 'Coffee. Wi-Fi. Focus.'
    WHEN 'The Loft' THEN 'Intimate space, curated crowd'
  END,
  CASE v.name
    WHEN 'The Rooftop' THEN 'Quiet rooftop bar with city views. Good for focus during the day, social after dark. Members get priority booths.'
    WHEN 'Daily Grind' THEN 'Neighborhood coffee shop built for getting things done. Fast Wi-Fi, good espresso, communal tables.'
    WHEN 'The Loft' THEN 'Small venue, big energy. Members-only after 9 PM. BYOB Thursdays are legendary.'
  END,
  '#F97316',
  true,
  CASE v.name
    WHEN 'The Rooftop' THEN '[{"name":"Drinks","items":["Espresso","Matcha Latte","Cold Brew","Sparkling Water","Natural Wine","Craft Beer"]},{"name":"Food","items":["Avocado Toast","Grain Bowl","Pastry Basket","Cheese Board"]}]'::jsonb
    WHEN 'Daily Grind' THEN '[{"name":"Coffee","items":["Espresso","Americano","Cortado","Pour Over","Cold Brew"]},{"name":"Snacks","items":["Croissant","Banana Bread","Granola Bar"]}]'::jsonb
    WHEN 'The Loft' THEN '[{"name":"Bar","items":["BYOB Thursday","House Red","House White","Local IPA"]},{"name":"Bites","items":["Olives","Flatbread","Hummus Plate"]}]'::jsonb
  END,
  '[{"day":"Mon-Fri","open":"7:00","close":"23:00"},{"day":"Sat-Sun","open":"9:00","close":"01:00"}]'::jsonb
FROM venues v
WHERE v.name IN ('The Rooftop', 'Daily Grind', 'The Loft');

-- Create Supabase Storage bucket for venue assets
-- (This needs to be done via dashboard or API, noting here for reference)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('venue-assets', 'venue-assets', true);
