
-- =====================================================
-- Função idempotente: garante bônus de indicação para um contrato
-- =====================================================
CREATE OR REPLACE FUNCTION public.ensure_partner_referral_bonuses(p_contract_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  -- Buscar contrato alvo
  SELECT * INTO v_contract
  FROM partner_contracts
  WHERE id = p_contract_id AND status = 'ACTIVE';

  IF v_contract.id IS NULL THEN
    RETURN;
  END IF;

  -- Sem indicador => nada a fazer
  IF v_contract.referred_by_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Bloquear autoindicação
  IF v_contract.referred_by_user_id = v_contract.user_id THEN
    RETURN;
  END IF;

  -- ========== NÍVEL 1: Indicador Direto ==========
  SELECT * INTO v_level1_contract
  FROM partner_contracts
  WHERE user_id = v_contract.referred_by_user_id
    AND status = 'ACTIVE'
  LIMIT 1;

  IF v_level1_contract.id IS NOT NULL THEN
    SELECT * INTO v_level1_plan
    FROM partner_plans
    WHERE name = v_level1_contract.plan_name
    LIMIT 1;

    SELECT COALESCE(points, 0) INTO v_level1_points
    FROM partner_level_points
    WHERE plan_name = v_contract.plan_name;

    v_bonus_value := v_contract.aporte_value * (COALESCE(v_level1_plan.referral_bonus_percentage, 10) / 100);

    INSERT INTO partner_referral_bonuses (
      referrer_contract_id, referred_contract_id, referred_user_id,
      aporte_value, bonus_percentage, bonus_value, referral_level, status
    ) VALUES (
      v_level1_contract.id, v_contract.id, v_contract.user_id,
      v_contract.aporte_value,
      COALESCE(v_level1_plan.referral_bonus_percentage, 10),
      v_bonus_value, 1, 'PENDING'
    ) ON CONFLICT (referred_contract_id, referral_level) DO NOTHING;

    -- Atualizar pontos do indicador nível 1 (só se bônus realmente inserido)
    IF FOUND THEN
      UPDATE partner_contracts
      SET total_referral_points = total_referral_points + COALESCE(v_level1_points, 0),
          updated_at = NOW()
      WHERE id = v_level1_contract.id;
    END IF;

    -- ========== NÍVEL 2 ==========
    IF v_level1_contract.referred_by_user_id IS NOT NULL THEN
      SELECT * INTO v_level2_contract
      FROM partner_contracts
      WHERE user_id = v_level1_contract.referred_by_user_id
        AND status = 'ACTIVE'
      LIMIT 1;

      IF v_level2_contract.id IS NOT NULL THEN
        SELECT * INTO v_level2_config
        FROM referral_level_config
        WHERE level = 2 AND is_active = true;

        IF v_level2_config.id IS NOT NULL AND v_level2_config.percentage > 0 THEN
          v_bonus_value := v_contract.aporte_value * (v_level2_config.percentage / 100);
          v_level2_points := COALESCE(v_level1_points / 2, 0);

          INSERT INTO partner_referral_bonuses (
            referrer_contract_id, referred_contract_id, referred_user_id,
            aporte_value, bonus_percentage, bonus_value, referral_level, status
          ) VALUES (
            v_level2_contract.id, v_contract.id, v_contract.user_id,
            v_contract.aporte_value, v_level2_config.percentage,
            v_bonus_value, 2, 'PENDING'
          ) ON CONFLICT (referred_contract_id, referral_level) DO NOTHING;

          IF FOUND THEN
            UPDATE partner_contracts
            SET total_referral_points = total_referral_points + v_level2_points,
                updated_at = NOW()
            WHERE id = v_level2_contract.id;
          END IF;

          -- ========== NÍVEL 3 ==========
          IF v_level2_contract.referred_by_user_id IS NOT NULL THEN
            SELECT * INTO v_level3_contract
            FROM partner_contracts
            WHERE user_id = v_level2_contract.referred_by_user_id
              AND status = 'ACTIVE'
            LIMIT 1;

            IF v_level3_contract.id IS NOT NULL THEN
              SELECT * INTO v_level3_config
              FROM referral_level_config
              WHERE level = 3 AND is_active = true;

              IF v_level3_config.id IS NOT NULL AND v_level3_config.percentage > 0 THEN
                v_bonus_value := v_contract.aporte_value * (v_level3_config.percentage / 100);

                INSERT INTO partner_referral_bonuses (
                  referrer_contract_id, referred_contract_id, referred_user_id,
                  aporte_value, bonus_percentage, bonus_value, referral_level, status
                ) VALUES (
                  v_level3_contract.id, v_contract.id, v_contract.user_id,
                  v_contract.aporte_value, v_level3_config.percentage,
                  v_bonus_value, 3, 'PENDING'
                ) ON CONFLICT (referred_contract_id, referral_level) DO NOTHING;
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;

-- =====================================================
-- Atualizar o trigger INSERT para usar a nova função
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_cascade_referral_bonuses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM ensure_partner_referral_bonuses(NEW.id);
  RETURN NEW;
END;
$$;

-- =====================================================
-- Trigger AFTER UPDATE de referred_by_user_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_ensure_referral_bonuses_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só dispara quando referred_by_user_id muda de NULL para um valor
  IF OLD.referred_by_user_id IS NULL AND NEW.referred_by_user_id IS NOT NULL THEN
    PERFORM ensure_partner_referral_bonuses(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_partner_contract_referred_updated
  AFTER UPDATE OF referred_by_user_id ON public.partner_contracts
  FOR EACH ROW
  WHEN (OLD.referred_by_user_id IS DISTINCT FROM NEW.referred_by_user_id)
  EXECUTE FUNCTION trigger_ensure_referral_bonuses_on_update();

-- =====================================================
-- BACKFILL: Preencher referred_by_user_id usando sponsor binário
-- =====================================================
UPDATE public.partner_contracts pc
SET referred_by_user_id = sponsor_user.user_id
FROM public.partner_binary_positions pbp
JOIN public.partner_contracts sponsor_user ON sponsor_user.id = pbp.sponsor_contract_id
WHERE pc.id = pbp.partner_contract_id
  AND pc.status = 'ACTIVE'
  AND pc.referred_by_user_id IS NULL
  AND sponsor_user.user_id != pc.user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.partner_referral_bonuses prb
    WHERE prb.referred_contract_id = pc.id AND prb.referral_level = 1
  );

-- =====================================================
-- BACKFILL: Gerar bônus faltantes para contratos com referred_by_user_id
-- preenchido mas sem bônus nível 1
-- =====================================================
DO $$
DECLARE
  v_contract RECORD;
BEGIN
  FOR v_contract IN
    SELECT pc.id
    FROM partner_contracts pc
    WHERE pc.status = 'ACTIVE'
      AND pc.referred_by_user_id IS NOT NULL
      AND pc.referred_by_user_id != pc.user_id
      AND NOT EXISTS (
        SELECT 1 FROM partner_referral_bonuses prb
        WHERE prb.referred_contract_id = pc.id AND prb.referral_level = 1
      )
  LOOP
    PERFORM ensure_partner_referral_bonuses(v_contract.id);
  END LOOP;
END;
$$;
