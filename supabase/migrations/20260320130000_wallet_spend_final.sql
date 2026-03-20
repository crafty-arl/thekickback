-- Definitive wallet_spend function: mode-aware, deducts balance, checks spending limit
-- Replaces all previous versions to fix balance persistence
CREATE OR REPLACE FUNCTION wallet_spend(
  p_user_id uuid,
  p_amount_cents integer,
  p_venue_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_mode text DEFAULT 'live'
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  w user_wallets%ROWTYPE;
  remaining integer;
  tx_id uuid;
BEGIN
  -- Find wallet filtered by mode
  SELECT * INTO w FROM user_wallets
    WHERE user_id = p_user_id AND active = true AND mode = p_mode;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active wallet for mode ' || p_mode);
  END IF;

  -- Reset spending period if expired
  PERFORM check_wallet_period(w.id);
  SELECT * INTO w FROM user_wallets WHERE id = w.id;

  -- Check prepaid balance
  IF w.balance_cents < p_amount_cents THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient funds', 'balance_cents', w.balance_cents);
  END IF;

  -- Check spending limit
  remaining := w.spending_limit_cents - w.spent_this_period_cents;
  IF p_amount_cents > remaining THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Exceeds spending limit', 'remaining_cents', remaining);
  END IF;

  -- Create transaction record with mode
  INSERT INTO wallet_transactions (wallet_id, user_id, venue_id, order_id, amount_cents, description, status, mode)
  VALUES (w.id, p_user_id, p_venue_id, p_order_id, p_amount_cents, p_description, 'completed', p_mode)
  RETURNING id INTO tx_id;

  -- Deduct from prepaid balance AND track spending
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
    'remaining_cents', remaining - p_amount_cents,
    'stripe_customer_id', w.stripe_customer_id,
    'stripe_payment_method_id', w.stripe_payment_method_id
  );
END;
$$;
