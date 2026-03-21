-- Add prepaid balance to wallets — users load funds, AI spends them down
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS balance_cents integer NOT NULL DEFAULT 0;

-- Update wallet_spend to deduct from prepaid balance
CREATE OR REPLACE FUNCTION wallet_spend(
  p_user_id uuid,
  p_amount_cents integer,
  p_venue_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  w user_wallets%ROWTYPE;
  tx_id uuid;
BEGIN
  SELECT * INTO w FROM user_wallets WHERE user_id = p_user_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active wallet');
  END IF;

  IF w.balance_cents < p_amount_cents THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient funds', 'balance_cents', w.balance_cents);
  END IF;

  -- Create transaction record
  INSERT INTO wallet_transactions (wallet_id, user_id, venue_id, order_id, amount_cents, description, status)
  VALUES (w.id, p_user_id, p_venue_id, p_order_id, p_amount_cents, p_description, 'completed')
  RETURNING id INTO tx_id;

  -- Deduct from balance
  UPDATE user_wallets SET
    balance_cents = balance_cents - p_amount_cents,
    spent_this_period_cents = spent_this_period_cents + p_amount_cents,
    updated_at = now()
  WHERE id = w.id;

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', tx_id,
    'wallet_id', w.id,
    'balance_cents', w.balance_cents - p_amount_cents,
    'stripe_customer_id', w.stripe_customer_id,
    'stripe_payment_method_id', w.stripe_payment_method_id
  );
END;
$$;
