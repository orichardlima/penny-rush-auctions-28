CREATE OR REPLACE FUNCTION public.add_business_days(p_ts timestamptz, p_days integer)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_ts timestamptz := p_ts;
  v_added integer := 0;
  v_dow integer;
BEGIN
  IF p_days IS NULL OR p_days <= 0 THEN
    RETURN p_ts;
  END IF;

  WHILE v_added < p_days LOOP
    v_ts := v_ts + INTERVAL '1 day';
    v_dow := EXTRACT(ISODOW FROM (v_ts AT TIME ZONE 'America/Bahia'))::int;
    IF v_dow <= 5 THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;

  RETURN v_ts;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.add_business_days(timestamptz, integer) TO authenticated, service_role;

DO $do$
DECLARE
  r RECORD;
  v_def text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('ensure_partner_referral_bonuses','process_partner_referral_bonus','unsuspend_bonuses_on_payment')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, 'NOW() + INTERVAL ''7 days''', 'public.add_business_days(NOW(), 7)');
    EXECUTE v_def;
  END LOOP;
END
$do$;

UPDATE public.partner_referral_bonuses
SET available_at = public.add_business_days(created_at, 7)
WHERE status = 'PENDING'
  AND available_at IS NOT NULL
  AND available_at > NOW();