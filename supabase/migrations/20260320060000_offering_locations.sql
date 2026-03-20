-- ============================================
-- Offering-Level Locations
-- Events/shows at specific places appear on the map
-- ============================================

ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS location_address text;
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS location_lat double precision;
ALTER TABLE venue_offerings ADD COLUMN IF NOT EXISTS location_lng double precision;
-- When set, this offering shows as its own dot on the map
-- Proximity searches pick it up independent of the hub's home base
