-- Clean all production venue data for fresh Milwaukee discovery
-- CASCADE handles all child tables (pages, offerings, staff, xp, perks, etc.)
DELETE FROM venues WHERE mode = 'live';
