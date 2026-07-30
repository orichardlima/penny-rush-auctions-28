-- 1) Desativar lançamento de pontos binários em upgrades (mantém função e histórico)
DROP TRIGGER IF EXISTS trg_upgrade_propagate_binary ON public.partner_upgrades;

-- 2) Regra oficial de diferença de pontos do upgrade (fonte única, reutilizando a regra legada)
CREATE OR REPLACE FUNCTION public.expansion_upgrade_points_delta(_upgrade_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_points JSONB;
  v_prev TEXT; v_new TEXT;
  v_new_aporte NUMERIC;
  v_contract UUID;
  v_cotas INT;
  v_is_demo BOOLEAN;
  v_plan_aporte NUMERIC;
  v_new_cotas INT;
  v_delta INT := 0;
BEGIN
  SELECT setting_value::jsonb INTO v_plan_points
  FROM public.system_settings WHERE setting_key = 'expansion_plan_points';

  SELECT u.previous_plan_name, u.new_plan_name, u.new_aporte_value, u.partner_contract_id
    INTO v_prev, v_new, v_new_aporte, v_contract
  FROM public.partner_upgrades u WHERE u.id = _upgrade_id;

  IF v_contract IS NULL THEN RETURN 0; END IF;

  SELECT c.cotas, c.is_demo INTO v_cotas, v_is_demo
  FROM public.partner_contracts c WHERE c.id = v_contract;

  IF v_is_demo IS TRUE THEN RETURN 0; END IF;

  IF v_prev = v_new THEN
    -- Upgrade de COTAS (mesma regra legada): pontos do plano x cotas adicionais
    SELECT aporte_value INTO v_plan_aporte
    FROM public.partner_plans WHERE name = v_new AND is_active = true LIMIT 1;

    IF v_plan_aporte IS NULL OR v_plan_aporte = 0 THEN RETURN 0; END IF;

    v_new_cotas := ROUND(v_new_aporte / v_plan_aporte);
    v_delta := COALESCE((v_plan_points ->> v_new)::int, 0) * (v_new_cotas - COALESCE(v_cotas, 1));
  ELSE
    -- Upgrade de PLANO (mesma regra legada): (pontos_novo - pontos_anterior) x cotas
    v_delta := (COALESCE((v_plan_points ->> v_new)::int, 0)
              - COALESCE((v_plan_points ->> v_prev)::int, 0)) * COALESCE(v_cotas, 1);
  END IF;

  IF v_delta < 0 THEN v_delta := 0; END IF;
  RETURN v_delta;
END;
$function$;

-- 3) Crédito do upgrade no Bônus de Expansão usando EXCLUSIVAMENTE a regra acima
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

  SELECT setting_value::timestamptz INTO v_cutoff
  FROM public.system_settings WHERE setting_key = 'expansion_cutoff_at';

  SELECT u.previous_plan_name, u.new_plan_name, u.created_at, u.partner_contract_id, c.user_id
    INTO v_prev, v_new, v_created, v_contract, v_user
  FROM public.partner_upgrades u
  JOIN public.partner_contracts c ON c.id = u.partner_contract_id
  WHERE u.id = _upgrade_id;

  IF v_user IS NULL THEN RETURN 0; END IF;
  IF v_cutoff IS NOT NULL AND v_created < v_cutoff THEN RETURN 0; END IF;

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

  IF v_id IS NULL THEN RETURN 0; END IF;  -- evento já processado (idempotente)
  RETURN v_delta;
END;
$function$;
