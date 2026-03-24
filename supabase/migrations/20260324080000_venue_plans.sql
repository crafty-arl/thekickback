-- Platform subscription plan for venues
-- Controls the platform fee rate on transactions
ALTER TABLE venues ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro', 'business'));

-- Update platform_fee_rate defaults based on plan
-- free = 15%, pro = 10%, business = 5%
COMMENT ON COLUMN venues.plan IS 'free=15% fee, pro=10% fee, business=5% fee';
