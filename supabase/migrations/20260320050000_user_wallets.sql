-- User AI Wallets — spending limits for frictionless AI-driven purchases
-- Users pre-load a spending limit, attach a card, and AI spends on their behalf

CREATE TABLE user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Stripe customer (for saving payment methods)
  stripe_customer_id text,
  stripe_payment_method_id text,
  card_last4 text,
  card_brand text,

  -- Spending limit
  spending_limit_cents integer NOT NULL DEFAULT 0,        -- max spend per period
  spent_this_period_cents integer NOT NULL DEFAULT 0,     -- how much spent so far
  period text NOT NULL DEFAULT 'weekly' CHECK (period IN ('daily', 'weekly', 'monthly')),
  period_started_at timestamptz NOT NULL DEFAULT now(),

  -- Auto-reload
  auto_reload boolean NOT NULL DEFAULT false,
  auto_reload_amount_cents integer DEFAULT 0,             -- reloads to this limit

  -- Status
  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_wallet UNIQUE (user_id)
);

-- Wallet transactions — every charge against the wallet
CREATE TABLE wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,

  amount_cents integer NOT NULL,
  description text,

  -- Stripe payment
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_wallets_user ON user_wallets(user_id);
CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_wallet_transactions_user ON wallet_transactions(user_id, created_at DESC);

-- RLS
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_read_own_wallet ON user_wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY users_update_own_wallet ON user_wallets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY service_manage_wallets ON user_wallets FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY users_read_own_transactions ON wallet_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY service_manage_transactions ON wallet_transactions FOR ALL USING (auth.role() = 'service_role');

-- Function: reset spending period if expired
CREATE OR REPLACE FUNCTION check_wallet_period(p_wallet_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  w user_wallets%ROWTYPE;
  period_end timestamptz;
BEGIN
  SELECT * INTO w FROM user_wallets WHERE id = p_wallet_id;
  IF NOT FOUND THEN RETURN; END IF;

  period_end := CASE w.period
    WHEN 'daily' THEN w.period_started_at + interval '1 day'
    WHEN 'weekly' THEN w.period_started_at + interval '7 days'
    WHEN 'monthly' THEN w.period_started_at + interval '1 month'
  END;

  IF now() >= period_end THEN
    UPDATE user_wallets SET
      spent_this_period_cents = 0,
      period_started_at = now(),
      updated_at = now()
    WHERE id = p_wallet_id;
  END IF;
END;
$$;

-- Function: spend from wallet (called by orders)
CREATE OR REPLACE FUNCTION wallet_spend(
  p_user_id uuid,
  p_amount_cents integer,
  p_venue_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  w user_wallets%ROWTYPE;
  remaining integer;
  tx_id uuid;
BEGIN
  SELECT * INTO w FROM user_wallets WHERE user_id = p_user_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active wallet');
  END IF;

  -- Reset period if expired
  PERFORM check_wallet_period(w.id);
  -- Re-read after potential reset
  SELECT * INTO w FROM user_wallets WHERE id = w.id;

  remaining := w.spending_limit_cents - w.spent_this_period_cents;
  IF p_amount_cents > remaining THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Exceeds spending limit', 'remaining_cents', remaining);
  END IF;

  IF w.stripe_payment_method_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No payment method on file');
  END IF;

  -- Create transaction record
  INSERT INTO wallet_transactions (wallet_id, user_id, venue_id, order_id, amount_cents, description, status)
  VALUES (w.id, p_user_id, p_venue_id, p_order_id, p_amount_cents, p_description, 'pending')
  RETURNING id INTO tx_id;

  -- Update spent amount
  UPDATE user_wallets SET
    spent_this_period_cents = spent_this_period_cents + p_amount_cents,
    updated_at = now()
  WHERE id = w.id;

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', tx_id,
    'wallet_id', w.id,
    'stripe_customer_id', w.stripe_customer_id,
    'stripe_payment_method_id', w.stripe_payment_method_id,
    'remaining_cents', remaining - p_amount_cents
  );
END;
$$;
