CREATE OR REPLACE FUNCTION public.partner_release_my_due_referral_bonuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_bonus RECORD;
  v_released integer := 0;
  v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_bonus IN
    SELECT b.id
      FROM public.partner_referral_bonuses b
      JOIN public.partner_contracts pc ON pc.id = b.referrer_contract_id
     WHERE pc.user_id = v_uid
       AND b.status = 'PENDING'
       AND b.available_at IS NOT NULL
       AND b.available_at <= now()
     ORDER BY b.available_at
  LOOP
    v_res := public.credit_referral_bonus_to_network_wallet(
               v_bonus.id, 'Liberação pós-carência (verificação em tela)');
    IF COALESCE((v_res->>'credited')::boolean, false) THEN
      v_released := v_released + 1;
    END IF;
  END LOOP;

  RETURN v_released;
END;
$function$;

REVOKE ALL ON FUNCTION public.partner_release_my_due_referral_bonuses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_release_my_due_referral_bonuses() TO authenticated;