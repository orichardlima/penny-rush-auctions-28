CREATE OR REPLACE FUNCTION public.points_admin_activate_pilot(
  p_rule_id              uuid,
  p_cutoff               timestamptz,
  p_pilot_user_ids       uuid[],
  p_audience_mode        text DEFAULT 'pilot'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_rule  record;
  v_webhooks_validated boolean;
  v_new_ver integer;
BEGIN
  IF NOT public.points_is_admin(v_admin) THEN
    RAISE EXCEPTION 'apenas admin' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_audience_mode NOT IN ('pilot','all') THEN
    RAISE EXCEPTION 'audience_mode inválido' USING ERRCODE='invalid_parameter_value';
  END IF;
  IF p_cutoff IS NULL THEN
    RAISE EXCEPTION 'cutoff obrigatório' USING ERRCODE='invalid_parameter_value';
  END IF;

  SELECT value
    INTO v_webhooks_validated
    FROM public.points_program_settings_bool
   WHERE key = 'webhooks_validated';

  IF COALESCE(v_webhooks_validated, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ativação bloqueada: webhooks_validated=false' USING ERRCODE='check_violation';
  END IF;

  SELECT * INTO v_rule FROM public.points_rules WHERE id = p_rule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'regra não existe' USING ERRCODE='no_data_found'; END IF;
  IF v_rule.is_active THEN RAISE EXCEPTION 'regra já ativa' USING ERRCODE='check_violation'; END IF;

  IF p_audience_mode='pilot' AND (p_pilot_user_ids IS NULL OR array_length(p_pilot_user_ids,1) IS NULL) THEN
    RAISE EXCEPTION 'pilot vazio' USING ERRCODE='check_violation';
  END IF;

  UPDATE public.points_rules
     SET is_active = true, active_from = p_cutoff
   WHERE id = p_rule_id;

  INSERT INTO public.points_program_settings_time (key, value, is_admin_only)
  VALUES ('points_accrual_started_at', p_cutoff, true)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  INSERT INTO public.points_program_settings_json (key, value, is_admin_only, updated_by)
  VALUES ('audience_mode', jsonb_build_object('mode', p_audience_mode), true, v_admin)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by;

  INSERT INTO public.points_program_settings_json (key, value, is_admin_only, updated_by)
  VALUES ('pilot_audience', jsonb_build_object('user_ids', to_jsonb(COALESCE(p_pilot_user_ids, ARRAY[]::uuid[]))), true, v_admin)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by;

  v_new_ver := public.points_audience_version() + 1;
  INSERT INTO public.points_program_settings_json (key, value, is_admin_only, updated_by)
  VALUES ('audience_version', jsonb_build_object('version', v_new_ver), true, v_admin)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by;

  INSERT INTO public.points_program_settings_bool (key, value, is_admin_only)
  VALUES ('points_program_enabled', true, true),
         ('points_accrual_enabled', true, true)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  INSERT INTO public.points_program_settings_audit (key, old_value, new_value, changed_by, changed_at)
  VALUES ('__activate_pilot__',
          to_jsonb(v_rule),
          jsonb_build_object('rule_id', p_rule_id, 'cutoff', p_cutoff,
                             'mode', p_audience_mode, 'audience_version', v_new_ver,
                             'pilot_size', COALESCE(array_length(p_pilot_user_ids,1),0)),
          v_admin, now());

  RETURN jsonb_build_object(
    'ok', true, 'rule_id', p_rule_id, 'cutoff', p_cutoff,
    'audience_mode', p_audience_mode, 'audience_version', v_new_ver
  );
END $$;

REVOKE ALL ON FUNCTION public.points_admin_activate_pilot(uuid,timestamptz,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.points_admin_activate_pilot(uuid,timestamptz,uuid[],text) TO authenticated;