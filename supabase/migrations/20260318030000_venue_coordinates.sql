-- Add coordinate columns to venues table
ALTER TABLE venues ADD COLUMN latitude double precision;
ALTER TABLE venues ADD COLUMN longitude double precision;

-- Update seed venues with Austin, TX coordinates
UPDATE venues SET latitude = 30.2672, longitude = -97.7431 WHERE slug = 'the-rooftop';
UPDATE venues SET latitude = 30.2740, longitude = -97.7407 WHERE slug = 'daily-grind';
UPDATE venues SET latitude = 30.2849, longitude = -97.7341 WHERE slug = 'study-loft';
UPDATE venues SET latitude = 30.2950, longitude = -97.7420 WHERE slug = 'north-house';
UPDATE venues SET latitude = 30.2615, longitude = -97.7260 WHERE slug = 'late-shift';
UPDATE venues SET latitude = 30.2555, longitude = -97.7480 WHERE slug = 'golden-hour';
UPDATE venues SET latitude = 30.2695, longitude = -97.7505 WHERE slug = 'the-den';
UPDATE venues SET latitude = 30.2780, longitude = -97.7380 WHERE slug = 'commons';
