CREATE OR REPLACE FUNCTION public.sync_bid_lots_on_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_delta integer;
  v_canonical uuid;
BEGIN
  v_delta := COALESCE(NEW.bids_balance,0) - COALESCE(OLD.bids_balance,0);
  IF v_delta <= 0 THEN RETURN NEW; END IF;

  v_canonical := public.points_canonical_credit_active();
  IF v_canonical IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bid_lots (
    user_id, source, initial_amount, remaining_amount,
    eligible_for_points, payment_eligible_for_points, lot_status
  ) VALUES (
    NEW.user_id, 'unknown', v_delta, v_delta,
    false, false, 'active'
  );
  RETURN NEW;
END $function$;