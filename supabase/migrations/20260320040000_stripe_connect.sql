-- Stripe Connect for venue owners
-- Each venue gets a Stripe Connect account for receiving payouts

ALTER TABLE venues ADD COLUMN IF NOT EXISTS stripe_account_id text;

-- Platform fee configuration per venue (based on their plan tier)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS platform_fee_rate numeric(4,3) DEFAULT 0.10;
-- Free: 0.10 (10%), Pro: 0.07 (7%), Network: 0.05 (5%)
