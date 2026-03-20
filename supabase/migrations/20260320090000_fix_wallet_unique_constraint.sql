-- Fix: allow one wallet per user per mode (test/live) instead of one per user
ALTER TABLE user_wallets DROP CONSTRAINT IF EXISTS unique_user_wallet;
ALTER TABLE user_wallets ADD CONSTRAINT unique_user_wallet_mode UNIQUE (user_id, mode);
