CREATE TABLE public.partner_referral_bonus_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  percentage numeric(6,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  reason text,
  set_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_referral_bonus_overrides TO authenticated;
GRANT ALL ON public.partner_referral_bonus_overrides TO service_role;
ALTER TABLE public.partner_referral_bonus_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read referral overrides" ON public.partner_referral_bonus_overrides
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

CREATE TABLE public.partner_referral_bonus_override_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  old_percentage numeric(6,2),
  new_percentage numeric(6,2),
  old_is_active boolean,
  new_is_active boolean,
  reason text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_referral_bonus_override_audit TO authenticated;
GRANT ALL ON public.partner_referral_bonus_override_audit TO service_role;
ALTER TABLE public.partner_referral_bonus_override_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read referral override audit" ON public.partner_referral_bonus_override_audit
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_set_referral_bonus_override(p_user_id uuid, p_percentage numeric, p_is_active boolean, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old public.partner_referral_bonus_overrides%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Parceiro inválido'; END IF;
  IF p_percentage IS NULL OR p_percentage < 0 OR p_percentage > 50 THEN
    RAISE EXCEPTION 'Percentual deve estar entre 0 e 50';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo';
  END IF;
  SELECT * INTO v_old FROM public.partner_referral_bonus_overrides WHERE user_id = p_user_id FOR UPDATE;
  INSERT INTO public.partner_referral_bonus_overrides (user_id, percentage, is_active, reason, set_by)
  VALUES (p_user_id, p_percentage, COALESCE(p_is_active, true), trim(p_reason), auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET percentage = EXCLUDED.percentage, is_active = EXCLUDED.is_active,
    reason = EXCLUDED.reason, set_by = EXCLUDED.set_by, updated_at = now();
  INSERT INTO public.partner_referral_bonus_override_audit (user_id, old_percentage, new_percentage, old_is_active, new_is_active, reason, changed_by)
  VALUES (p_user_id, v_old.percentage, p_percentage, v_old.is_active, COALESCE(p_is_active, true), trim(p_reason), auth.uid());
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_referral_bonus_override(uuid, numeric, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_referral_bonus_override(uuid, numeric, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_partner_referral_bonuses(p_contract_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_level1_contract RECORD;
  v_level2_contract RECORD;
  v_level3_contract RECORD;
  v_level1_plan RECORD;
  v_level2_config RECORD;
  v_level3_config RECORD;
  v_level1_points INTEGER;
  v_level2_points INTEGER;
  v_bonus_value NUMERIC;
  v_bonus_status TEXT;
  v_bonus_available_at TIMESTAMPTZ;
  v_suspended_expires_at TIMESTAMPTZ;
  v_level1_pct NUMERIC;
BEGIN
  SELECT * INTO v_contract
  FROM partner_contracts
  WHERE id = p_contract_id AND status = 'ACTIVE';

  IF v_contract.id IS NULL THEN RETURN; END IF;
  IF v_contract.is_demo = true THEN RETURN; END IF;
  IF v_contract.referred_by_user_id IS NULL THEN RETURN; END IF;
  IF v_contract.referred_by_user_id = v_contract.user_id THEN RETURN; END IF;

  SELECT * INTO v_level1_contract
  FROM partner_contracts
  WHERE user_id = v_contract.referred_by_user_id AND status = 'ACTIVE'
  LIMIT 1;

  IF v_level1_contract.id IS NOT NULL THEN
    SELECT * INTO v_level1_plan
    FROM partner_plans
    WHERE name = v_level1_contract.plan_name
    LIMIT 1;

    SELECT COALESCE(points, 0) INTO v_level1_points
    FROM partner_level_points
    WHERE plan_name = v_contract.plan_name;

    SELECT o.percentage INTO v_level1_pct
    FROM public.partner_referral_bonus_overrides o
    WHERE o.user_id = v_level1_contract.user_id AND o.is_active = true;
    v_level1_pct := COALESCE(v_level1_pct, v_level1_plan.referral_bonus_percentage, 10);

    v_bonus_value := v_contract.aporte_value * (v_level1_pct / 100);

    IF v_level1_contract.financial_status = 'paid' THEN
      v_bonus_status := 'PENDING';
      v_bonus_available_at := public.add_business_days(NOW(), 7);
      v_suspended_expires_at := NULL;
    ELSE
      v_bonus_status := 'SUSPENDED';
      v_bonus_available_at := NULL;
      v_suspended_expires_at := NOW() + INTERVAL '3 days';
    END IF;

    INSERT INTO partner_referral_bonuses (
      referrer_contract_id, referred_contract_id, referred_user_id,
      aporte_value, bonus_percentage, bonus_value, referral_level, status, available_at, suspended_expires_at, source_event
    ) VALUES (
      v_level1_contract.id, v_contract.id, v_contract.user_id,
      v_contract.aporte_value,
      v_level1_pct,
      v_bonus_value, 1, v_bonus_status, v_bonus_available_at, v_suspended_expires_at, 'activation'
    ) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus, source_event) DO NOTHING;

    IF FOUND THEN
      UPDATE partner_contracts
      SET total_referral_points = total_referral_points + COALESCE(v_level1_points, 0),
          updated_at = NOW()
      WHERE id = v_level1_contract.id;
    END IF;

    IF v_level1_contract.referred_by_user_id IS NOT NULL THEN
      SELECT * INTO v_level2_contract
      FROM partner_contracts
      WHERE user_id = v_level1_contract.referred_by_user_id AND status = 'ACTIVE'
      LIMIT 1;

      IF v_level2_contract.id IS NOT NULL THEN
        SELECT * INTO v_level2_config
        FROM referral_level_config
        WHERE level = 2 AND is_active = true;

        IF v_level2_config.id IS NOT NULL AND v_level2_config.percentage > 0 THEN
          v_bonus_value := v_contract.aporte_value * (v_level2_config.percentage / 100);
          v_level2_points := COALESCE(v_level1_points / 2, 0);

          IF v_level2_contract.financial_status = 'paid' THEN
            v_bonus_status := 'PENDING';
            v_bonus_available_at := public.add_business_days(NOW(), 7);
            v_suspended_expires_at := NULL;
          ELSE
            v_bonus_status := 'SUSPENDED';
            v_bonus_available_at := NULL;
            v_suspended_expires_at := NOW() + INTERVAL '3 days';
          END IF;

          INSERT INTO partner_referral_bonuses (
            referrer_contract_id, referred_contract_id, referred_user_id,
            aporte_value, bonus_percentage, bonus_value, referral_level, status, available_at, suspended_expires_at, source_event
          ) VALUES (
            v_level2_contract.id, v_contract.id, v_contract.user_id,
            v_contract.aporte_value,
            v_level2_config.percentage,
            v_bonus_value, 2, v_bonus_status, v_bonus_available_at, v_suspended_expires_at, 'activation'
          ) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus, source_event) DO NOTHING;

          IF FOUND THEN
            UPDATE partner_contracts
            SET total_referral_points = total_referral_points + v_level2_points,
                updated_at = NOW()
            WHERE id = v_level2_contract.id;
          END IF;
        END IF;

        IF v_level2_contract.referred_by_user_id IS NOT NULL THEN
          SELECT * INTO v_level3_contract
          FROM partner_contracts
          WHERE user_id = v_level2_contract.referred_by_user_id AND status = 'ACTIVE'
          LIMIT 1;

          IF v_level3_contract.id IS NOT NULL THEN
            SELECT * INTO v_level3_config
            FROM referral_level_config
            WHERE level = 3 AND is_active = true;

            IF v_level3_config.id IS NOT NULL AND v_level3_config.percentage > 0 THEN
              v_bonus_value := v_contract.aporte_value * (v_level3_config.percentage / 100);

              IF v_level3_contract.financial_status = 'paid' THEN
                v_bonus_status := 'PENDING';
                v_bonus_available_at := public.add_business_days(NOW(), 7);
                v_suspended_expires_at := NULL;
              ELSE
                v_bonus_status := 'SUSPENDED';
                v_bonus_available_at := NULL;
                v_suspended_expires_at := NOW() + INTERVAL '3 days';
              END IF;

              INSERT INTO partner_referral_bonuses (
                referrer_contract_id, referred_contract_id, referred_user_id,
                aporte_value, bonus_percentage, bonus_value, referral_level, status, available_at, suspended_expires_at, source_event
              ) VALUES (
                v_level3_contract.id, v_contract.id, v_contract.user_id,
                v_contract.aporte_value,
                v_level3_config.percentage,
                v_bonus_value, 3, v_bonus_status, v_bonus_available_at, v_suspended_expires_at, 'activation'
              ) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus, source_event) DO NOTHING;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
END;
$function$;