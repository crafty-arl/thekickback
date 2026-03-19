-- Add coordinate columns to venues table
ALTER TABLE venues ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS longitude double precision;

-- Update seed venues with Austin, TX coordinates
UPDATE venues SET latitude = 30.2672, longitude = -97.7431 WHERE name = 'The Rooftop';
UPDATE venues SET latitude = 30.2740, longitude = -97.7407 WHERE name = 'Daily Grind';
UPDATE venues SET latitude = 30.2849, longitude = -97.7341 WHERE name = 'The Loft';
