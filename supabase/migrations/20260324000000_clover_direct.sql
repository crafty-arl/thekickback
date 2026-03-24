-- Direct Clover API integration (replaces Apideck)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS clover_api_key text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS clover_merchant_id text;
