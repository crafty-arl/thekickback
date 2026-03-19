-- ============================================
-- Venue Photos Setup
-- Create storage bucket + seed hero images & gallery
-- ============================================

-- Seed hero_image on venue_pages for demo venues
UPDATE venue_pages
SET hero_image = '/venues/the-rooftop.png'
WHERE slug = 'the-rooftop';

UPDATE venue_pages
SET hero_image = '/venues/daily-grind.png'
WHERE slug = 'daily-grind';

UPDATE venue_pages
SET hero_image = '/venues/the-loft.png'
WHERE slug = 'the-loft';

-- Seed venue_gallery with demo photos
INSERT INTO venue_gallery (venue_id, image_url, caption, sort_order)
SELECT v.id, '/venues/the-rooftop.png', 'Skyline views at golden hour', 0
FROM venues v WHERE v.name = 'The Rooftop'
ON CONFLICT DO NOTHING;

INSERT INTO venue_gallery (venue_id, image_url, caption, sort_order)
SELECT v.id, '/venues/daily-grind.png', 'Our cozy pour-over bar', 0
FROM venues v WHERE v.name = 'Daily Grind'
ON CONFLICT DO NOTHING;

INSERT INTO venue_gallery (venue_id, image_url, caption, sort_order)
SELECT v.id, '/venues/the-loft.png', 'Candlelit vibes downstairs', 0
FROM venues v WHERE v.name = 'The Loft'
ON CONFLICT DO NOTHING;

-- Add RLS policy for venue owners to manage their gallery
CREATE POLICY IF NOT EXISTS "venue_owners_manage_gallery" ON venue_gallery
  FOR ALL USING (
    venue_id IN (SELECT vo.venue_id FROM venue_owners vo WHERE vo.user_id = auth.uid())
  ) WITH CHECK (
    venue_id IN (SELECT vo.venue_id FROM venue_owners vo WHERE vo.user_id = auth.uid())
  );
