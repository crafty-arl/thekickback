-- Remove remaining Austin sample venues
-- (The Rooftop, Daily Grind, The Loft — original demo data)
DELETE FROM venues WHERE id IN (
  '1cbe6de9-a7cf-4e73-8090-34e24728df19',  -- The Rooftop (Austin)
  '0a736f50-a50b-432c-8c9c-e91910fd5b59',  -- Daily Grind (Austin)
  'a6820575-addd-4c64-8fe5-512c5d8e345a'   -- The Loft (Austin)
);
