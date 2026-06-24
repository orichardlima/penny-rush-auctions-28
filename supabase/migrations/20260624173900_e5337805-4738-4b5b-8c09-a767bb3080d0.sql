-- Allow internal recalc to update aggregate fields by setting a session flag.
-- The protect trigger keeps blocking all other client updates as before.

CREATE OR REPLACE FUNCTION public.protect_partner_contract_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  allow_totals text;
BEGIN
  BEGIN
    allow_totals := current_setting('app.allow_total_sync', true);
  EXCEPTION WHEN OTHERS THEN
    allow_totals := NULL;
  END;

  IF NOT is_admin_user(auth.uid()) THEN
    NEW.status := OLD.status;
    NEW.total_cap := OLD.total_cap;
    NEW.weekly_cap := OLD.weekly_cap;
    NEW.aporte_value := OLD.aporte_value;
    -- Allow internal recalc to sync these aggregates
    IF allow_totals IS DISTINCT FROM 'on' THEN
      NEW.total_received := OLD.total_received;
      NEW.total_withdrawn := OLD.total_withdrawn;
    END IF;
    NEW.available_balance := OLD.available_balance;
    NEW.total_referral_points := OLD.total_referral_points;
    NEW.plan_name := OLD.plan_name;
    NEW.referral_code := OLD.referral_code;
    NEW.payment_status := OLD.payment_status;
    NEW.bonus_bids_received := OLD.bonus_bids_received;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_partner_contract_totals(_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.allow_total_sync', 'on', true);

  UPDATE public.partner_contracts pc
  SET
    total_received = COALESCE((
      SELECT SUM(amount) FROM public.partner_payouts
      WHERE partner_contract_id = _contract_id AND status = 'PAID'
    ), 0),
    total_withdrawn = COALESCE((
      SELECT SUM(amount) FROM public.partner_withdrawals
      WHERE partner_contract_id = _contract_id AND status = 'PAID'
    ), 0),
    updated_at = now()
  WHERE pc.id = _contract_id;

  PERFORM set_config('app.allow_total_sync', 'off', true);
END;
$$;