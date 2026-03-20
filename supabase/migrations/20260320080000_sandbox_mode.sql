-- ─── Sandbox / Production isolation ────────────────────────────────
-- Add mode column ('test' | 'live') to financial tables so sandbox
-- and production data stay separated in a single database.

-- 1. user_wallets
ALTER TABLE user_wallets
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

-- 2. wallet_transactions
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

-- 3. orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

-- 4. order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

-- 5. venue_bookings
ALTER TABLE venue_bookings
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

-- 6. perk_redemptions
ALTER TABLE perk_redemptions
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

-- Separate Stripe Connect test account column on venues
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS stripe_test_account_id text;

-- Add a seeded flag for demo data cleanup / idempotency
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS seeded boolean NOT NULL DEFAULT false;

-- ─── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_mode ON user_wallets (user_id, mode);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_mode ON wallet_transactions (user_id, mode);
CREATE INDEX IF NOT EXISTS idx_orders_user_mode ON orders (user_id, mode);
CREATE INDEX IF NOT EXISTS idx_orders_venue_mode ON orders (venue_id, mode);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_venue_mode ON venue_bookings (venue_id, mode);
CREATE INDEX IF NOT EXISTS idx_perk_redemptions_venue_mode ON perk_redemptions (venue_id, mode);
