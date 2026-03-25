-- Remove Austin sample venues (Tight Lines Barbershop, Lacquer Lounge)
-- CASCADE will clean up pages, staff, offerings, xp, perks, staff_offerings
DELETE FROM venues WHERE id IN (
  'b0b0b0b0-fade-4000-a000-ba0be0500001',
  'a1a1a1a1-face-4000-b000-0a115a100001'
);
