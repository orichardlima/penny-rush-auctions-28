
-- 1. Backfill existing NULL available_at
UPDATE partner_referral_bonuses
SET available_at = created_at + INTERVAL '7 days'
WHERE available_at IS NULL;

-- 2. Set default for future inserts
ALTER TABLE partner_referral_bonuses
ALTER COLUMN available_at SET DEFAULT (timezone('America/Sao_Paulo', now()) + INTERVAL '7 days');

-- 3. Recreate function with available_at in all INSERTs
CREATE OR REPLACE FUNCTION public.ensure_partner_referral_bonuses(p_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  SELECT * INTO v_contract
  FROM partner_contracts
  WHERE id = p_contract_id AND status = 'ACTIVE';

  IF v_contract.id IS NULL THEN RETURN; END IF;
  IF v_contract.is_demo = true THEN RETURN; END IF;
  IF v_contract.referred_by_user_id IS NULL THEN RETURN; END IF;
  IF v_contract.referred_by_user_id = v_contract.user_id THEN RETURN; END IF;

  -- ========== NÍVEL 1 ==========
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

    v_bonus_value := v_contract.aporte_value * (COALESCE(v_level1_plan.referral_bonus_percentage, 10) / 100);

    INSERT INTO partner_referral_bonuses (
      referrer_contract_id, referred_contract_id, referred_user_id,
      aporte_value, bonus_percentage, bonus_value, referral_level, status, available_at
    ) VALUES (
      v_level1_contract.id, v_contract.id, v_contract.user_id,
      v_contract.aporte_value,
      COALESCE(v_level1_plan.referral_bonus_percentage, 10),
      v_bonus_value, 1, 'PENDING', NOW() + INTERVAL '7 days'
    ) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus) DO NOTHING;

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
      WHERE user_id = v_level1_contract.referred_by_user_id AND status = 'ACTIVE'
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
            aporte_value, bonus_percentage, bonus_value, referral_level, status, available_at
          ) VALUES (
            v_level2_contract.id, v_contract.id, v_contract.user_id,
            v_contract.aporte_value,
            v_level2_config.percentage,
            v_bonus_value, 2, 'PENDING', NOW() + INTERVAL '7 days'
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
          WHERE user_id = v_level2_contract.referred_by_user_id AND status = 'ACTIVE'
          LIMIT 1;

          IF v_level3_contract.id IS NOT NULL THEN
            SELECT * INTO v_level3_config
            FROM referral_level_config
            WHERE level = 3 AND is_active = true;

            IF v_level3_config.id IS NOT NULL AND v_level3_config.percentage > 0 THEN
              v_bonus_value := v_contract.aporte_value * (v_level3_config.percentage / 100);

              INSERT INTO partner_referral_bonuses (
                referrer_contract_id, referred_contract_id, referred_user_id,
                aporte_value, bonus_percentage, bonus_value, referral_level, status, available_at
              ) VALUES (
                v_level3_contract.id, v_contract.id, v_contract.user_id,
                v_contract.aporte_value,
                v_level3_config.percentage,
                v_bonus_value, 3, 'PENDING', NOW() + INTERVAL '7 days'
              ) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus) DO NOTHING;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;

-- 4. Release any bonuses that are already past 7 days
SELECT public.release_pending_referral_bonuses();
