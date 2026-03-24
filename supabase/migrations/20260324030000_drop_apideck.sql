-- Remove dead Apideck column (replaced by direct Clover integration)
ALTER TABLE venues DROP COLUMN IF EXISTS apideck_consumer_id;
