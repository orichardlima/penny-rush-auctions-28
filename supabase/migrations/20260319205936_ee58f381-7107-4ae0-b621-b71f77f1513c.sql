-- Fix: Allow both regular and fast-start bonuses for the same contract+level
-- Drop the old 2-column unique constraint
ALTER TABLE public.partner_referral_bonuses 
  DROP CONSTRAINT IF EXISTS partner_referral_bonuses_referred_contract_level_key;

-- Create new 3-column unique constraint including is_fast_start_bonus
ALTER TABLE public.partner_referral_bonuses 
  ADD CONSTRAINT partner_referral_bonuses_referred_contract_level_key 
  UNIQUE (referred_contract_id, referral_level, is_fast_start_bonus);

-- Update ensure_partner_referral_bonuses to use the new 3-column ON CONFLICT
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
BEGIN
  -- Buscar contrato alvo
  SELECT * INTO v_contract
  FROM partner_contracts
  WHERE id = p_contract_id AND status = 'ACTIVE';

  IF v_contract.id IS NULL THEN
    RETURN;
  END IF;

  -- GUARD: Se o contrato é demo, não gerar bônus de indicação
  IF v_contract.is_demo = true THEN
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
    ) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus) DO NOTHING;

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
            v_contract.aporte_value,
            v_level2_config.percentage,
            v_bonus_value, 2, 'PENDING'
          ) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus) DO NOTHING;

          IF FOUND THEN
            UPDATE partner_contracts
            SET total_referral_points = total_referral_points + v_level2_points,
                updated_at = NOW()
            WHERE id = v_level2_contract.id;
          END IF;
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
                v_contract.aporte_value,
                v_level3_config.percentage,
                v_bonus_value, 3, 'PENDING'
              ) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus) DO NOTHING;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
END;
$function$;