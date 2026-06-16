
CREATE OR REPLACE FUNCTION public.credit_purchase_bids(
  p_user_id uuid,
  p_amount numeric,
  p_purchase_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
  PERFORM set_config('app.bid_credit_source', 'purchase', true);
  PERFORM set_config('app.bid_credit_expires_at', (now() + interval '30 days')::text, true);
  IF p_purchase_id IS NOT NULL THEN
    PERFORM set_config('app.bid_credit_source_ref', p_purchase_id::text, true);
  END IF;

  UPDATE public.profiles
     SET bids_balance = COALESCE(bids_balance, 0) + p_amount,
         updated_at = now()
   WHERE user_id = p_user_id
  RETURNING bids_balance INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'profile not found for user %', p_user_id;
  END IF;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_purchase_bids(uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_purchase_bids(uuid, numeric, uuid) TO service_role;
