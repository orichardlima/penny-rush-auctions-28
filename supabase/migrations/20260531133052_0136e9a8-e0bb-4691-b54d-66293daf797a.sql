CREATE OR REPLACE FUNCTION public.partner_check_leave_eligibility(p_contract_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_days_since int;
  v_deadline timestamptz;
  v_last_exit timestamptz;
  v_cooldown_until timestamptz;
  v_active_exit uuid;
BEGIN
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'contract_not_found');
  END IF;
  IF v_contract.user_id <> auth.uid() AND NOT is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_owner');
  END IF;
  IF v_contract.status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'contract_not_active');
  END IF;
  IF COALESCE(v_contract.financial_status,'paid') <> 'paid' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'contract_delinquent');
  END IF;
  IF v_contract.referred_by_user_id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_sponsor');
  END IF;

  v_days_since := EXTRACT(DAY FROM (now() - v_contract.created_at))::int;
  v_deadline   := v_contract.created_at + interval '30 days';
  IF v_days_since >= 30 THEN
    RETURN jsonb_build_object(
      'eligible', false, 'reason', 'window_expired',
      'days_since_activation', v_days_since,
      'deadline', v_deadline
    );
  END IF;

  SELECT id INTO v_active_exit FROM partner_network_exits
   WHERE partner_contract_id = p_contract_id AND status = 'IN_TRANSIT' LIMIT 1;
  IF v_active_exit IS NOT NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'exit_in_progress', 'exit_id', v_active_exit);
  END IF;

  SELECT MAX(created_at) INTO v_last_exit FROM partner_network_exits
   WHERE partner_contract_id = p_contract_id AND status IN ('COMPLETED','REVERTED_TIMEOUT');
  IF v_last_exit IS NOT NULL THEN
    v_cooldown_until := v_last_exit + interval '90 days';
    IF v_cooldown_until > now() THEN
      RETURN jsonb_build_object(
        'eligible', false, 'reason', 'cooldown',
        'cooldown_until', v_cooldown_until,
        'last_exit_at', v_last_exit
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'days_since_activation', v_days_since,
    'days_until_deadline', 30 - v_days_since,
    'deadline', v_deadline,
    'last_exit_at', v_last_exit
  );
END;
$function$;