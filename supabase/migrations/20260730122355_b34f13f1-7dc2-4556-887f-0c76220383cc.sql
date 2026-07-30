CREATE OR REPLACE FUNCTION public.expansion_effective_cutoff()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NULLIF(btrim(setting_value), '')::timestamptz
  FROM public.system_settings
  WHERE setting_key = 'expansion_official_start_at'
$$;

CREATE OR REPLACE FUNCTION public.expansion_credit_contract_activation(_contract_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gen_enabled BOOLEAN;
  v_cutoff TIMESTAMPTZ;
  v_plan_points JSONB;
  v_user UUID;
  v_plan TEXT;
  v_created TIMESTAMPTZ;
  v_points INT;
BEGIN
  SELECT (setting_value::boolean) INTO v_gen_enabled FROM public.system_settings WHERE setting_key='expansion_points_generation_enabled';
  IF NOT COALESCE(v_gen_enabled,false) THEN RETURN 0; END IF;

  -- Guarda temporal oficial: sem data oficial definida, nada gera pontos.
  v_cutoff := public.expansion_effective_cutoff();
  IF v_cutoff IS NULL THEN RETURN 0; END IF;

  SELECT setting_value::jsonb INTO v_plan_points FROM public.system_settings WHERE setting_key='expansion_plan_points';

  SELECT user_id, plan_name, created_at INTO v_user, v_plan, v_created
  FROM public.partner_contracts WHERE id = _contract_id AND status='ACTIVE';
  IF v_user IS NULL THEN RETURN 0; END IF;
  IF v_created < v_cutoff THEN RETURN 0; END IF;

  v_points := COALESCE((v_plan_points ->> v_plan)::int, 0);
  IF v_points <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.expansion_points_ledger
    (user_id, contract_id, plan_name, points, source, source_ref, status, metadata)
  VALUES
    (v_user, _contract_id, v_plan, v_points, 'contract_activation', _contract_id::text || ':activation', 'CONFIRMED',
     jsonb_build_object('plan', v_plan))
  ON CONFLICT (source_ref) DO NOTHING;

  RETURN v_points;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expansion_credit_upgrade(_upgrade_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gen_enabled BOOLEAN;
  v_cutoff TIMESTAMPTZ;
  v_prev TEXT; v_new TEXT;
  v_user UUID; v_contract UUID; v_created TIMESTAMPTZ;
  v_delta INT;
  v_ref TEXT;
  v_id UUID;
BEGIN
  SELECT (setting_value::boolean) INTO v_gen_enabled
  FROM public.system_settings WHERE setting_key = 'expansion_points_generation_enabled';
  IF NOT COALESCE(v_gen_enabled, false) THEN RETURN 0; END IF;

  v_cutoff := public.expansion_effective_cutoff();
  IF v_cutoff IS NULL THEN RETURN 0; END IF;

  SELECT u.previous_plan_name, u.new_plan_name, u.created_at, u.partner_contract_id, c.user_id
    INTO v_prev, v_new, v_created, v_contract, v_user
  FROM public.partner_upgrades u
  JOIN public.partner_contracts c ON c.id = u.partner_contract_id
  WHERE u.id = _upgrade_id;

  IF v_user IS NULL THEN RETURN 0; END IF;
  IF v_created < v_cutoff THEN RETURN 0; END IF;

  v_delta := public.expansion_upgrade_points_delta(_upgrade_id);
  IF v_delta <= 0 THEN RETURN 0; END IF;

  v_ref := _upgrade_id::text || ':upgrade';

  INSERT INTO public.expansion_points_ledger
    (user_id, contract_id, plan_name, points, source, source_ref, status, metadata)
  VALUES
    (v_user, v_contract, v_new, v_delta, 'contract_upgrade', v_ref, 'CONFIRMED',
     jsonb_build_object('from', v_prev, 'to', v_new, 'rule', 'plan_points_delta'))
  ON CONFLICT (source_ref) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 0; END IF;
  RETURN v_delta;
END;
$function$;

SELECT cron.schedule(
  'expansion-weekly-close',
  '5 3 * * 1',
  $$SELECT public.expansion_run_weekly_close(NULL, 'CRON', NULL, 'cron semanal 00:05 America/Bahia');$$
);