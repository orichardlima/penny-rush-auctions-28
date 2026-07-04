
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES ('contract_reaccept_enforcement_enabled', 'false', 'boolean',
        'Quando false, o ContractReacceptGuard não força reaceite mesmo se as versões divergirem.')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_contract_version_status(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_bettor_current text;
  v_partner_current text;
  v_bettor_accepted text;
  v_partner_accepted text;
  v_has_partner_contract boolean := false;
  v_enforce boolean := false;
  v_bettor_needs boolean := false;
  v_partner_needs boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'bettor', jsonb_build_object('current', null, 'accepted', null, 'needs_reaccept', false),
      'partner', jsonb_build_object('current', null, 'accepted', null, 'needs_reaccept', false),
      'enforcement_enabled', false
    );
  END IF;

  SELECT (setting_value = 'true') INTO v_enforce
    FROM public.system_settings WHERE setting_key='contract_reaccept_enforcement_enabled';
  v_enforce := COALESCE(v_enforce, false);

  SELECT setting_value INTO v_bettor_current FROM public.system_settings WHERE setting_key='current_bettor_contract_version';
  SELECT setting_value INTO v_partner_current FROM public.system_settings WHERE setting_key='current_partner_contract_version';

  SELECT version_label INTO v_bettor_accepted
  FROM public.contract_acceptances
  WHERE user_id = v_user_id AND contract_type = 'bettor'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT EXISTS(
    SELECT 1 FROM public.partner_contracts
    WHERE user_id = v_user_id AND status IN ('ACTIVE','PENDING')
  ) INTO v_has_partner_contract;

  IF v_has_partner_contract THEN
    SELECT version_label INTO v_partner_accepted
    FROM public.contract_acceptances
    WHERE user_id = v_user_id AND contract_type = 'partner'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Só bloqueia quando (a) enforcement ligado, (b) usuário JÁ aceitou uma versão anterior,
  -- e (c) essa versão é diferente da vigente. Nunca força reaceite retroativo.
  IF v_enforce THEN
    v_bettor_needs := (v_bettor_current IS NOT NULL
                       AND v_bettor_accepted IS NOT NULL
                       AND v_bettor_accepted IS DISTINCT FROM v_bettor_current);
    v_partner_needs := (v_has_partner_contract
                        AND v_partner_current IS NOT NULL
                        AND v_partner_accepted IS NOT NULL
                        AND v_partner_accepted IS DISTINCT FROM v_partner_current);
  END IF;

  RETURN jsonb_build_object(
    'bettor', jsonb_build_object(
      'current', v_bettor_current,
      'accepted', v_bettor_accepted,
      'needs_reaccept', v_bettor_needs
    ),
    'partner', jsonb_build_object(
      'current', v_partner_current,
      'accepted', v_partner_accepted,
      'needs_reaccept', v_partner_needs
    ),
    'enforcement_enabled', v_enforce
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_contract_version_status(uuid) TO authenticated;
