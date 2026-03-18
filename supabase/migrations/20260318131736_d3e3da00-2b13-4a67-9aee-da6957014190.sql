-- 1. Update trigger to accept session flag for authorized internal functions
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) != 'service_role'
     AND coalesce(current_setting('app.allow_sensitive_profile_update', true), '') != 'true'
  THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := OLD.is_blocked;
    NEW.bids_balance := OLD.bids_balance;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Update place_bid to set the session flag before updating balance
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT bids_balance INTO v_balance
  FROM profiles WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 1 THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);

  UPDATE profiles SET bids_balance = bids_balance - 1
  WHERE user_id = p_user_id;

  PERFORM set_config('app.allow_sensitive_profile_update', '', true);

  INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
  VALUES (p_auction_id, p_user_id, 1, 1.00);
END;
$$;