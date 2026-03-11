
-- Add is_demo column to partner_contracts
ALTER TABLE public.partner_contracts 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- Guard in ensure_partner_referral_bonuses: skip if demo
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
            v_contract.aporte_value,
            v_level2_config.percentage,
            v_bonus_value, 2, 'PENDING'
          ) ON CONFLICT (referred_contract_id, referral_level) DO NOTHING;

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
              ) ON CONFLICT (referred_contract_id, referral_level) DO NOTHING;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;

-- =====================================================
-- Guard in position_partner_binary: skip points if demo
-- =====================================================
CREATE OR REPLACE FUNCTION public.position_partner_binary(
  p_contract_id UUID,
  p_sponsor_contract_id UUID,
  p_position TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
  v_current_id UUID;
  v_points INTEGER;
  v_plan_name TEXT;
  v_existing_child UUID;
  v_is_demo BOOLEAN;
BEGIN
  -- Validar posição
  IF p_position NOT IN ('left', 'right') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posição inválida. Use left ou right.');
  END IF;
  
  -- Verificar se já existe posição
  IF EXISTS (SELECT 1 FROM public.partner_binary_positions WHERE partner_contract_id = p_contract_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parceiro já está posicionado na árvore.');
  END IF;
  
  -- Verificar se o sponsor tem posição
  IF NOT EXISTS (SELECT 1 FROM public.partner_binary_positions WHERE partner_contract_id = p_sponsor_contract_id) THEN
    INSERT INTO public.partner_binary_positions (partner_contract_id)
    VALUES (p_sponsor_contract_id);
  END IF;
  
  -- Verificar se a posição direta no sponsor está disponível
  IF p_position = 'left' THEN
    SELECT left_child_id INTO v_existing_child
    FROM public.partner_binary_positions WHERE partner_contract_id = p_sponsor_contract_id;
  ELSE
    SELECT right_child_id INTO v_existing_child
    FROM public.partner_binary_positions WHERE partner_contract_id = p_sponsor_contract_id;
  END IF;
  
  IF v_existing_child IS NULL THEN
    v_parent_id := p_sponsor_contract_id;
  ELSE
    v_current_id := v_existing_child;
    
    LOOP
      IF p_position = 'left' THEN
        SELECT left_child_id INTO v_existing_child
        FROM public.partner_binary_positions WHERE partner_contract_id = v_current_id;
      ELSE
        SELECT right_child_id INTO v_existing_child
        FROM public.partner_binary_positions WHERE partner_contract_id = v_current_id;
      END IF;
      
      IF v_existing_child IS NULL THEN
        v_parent_id := v_current_id;
        EXIT;
      END IF;
      
      v_current_id := v_existing_child;
    END LOOP;
  END IF;
  
  -- Criar posição para o novo parceiro
  INSERT INTO public.partner_binary_positions (
    partner_contract_id,
    sponsor_contract_id,
    parent_contract_id,
    position
  ) VALUES (
    p_contract_id,
    p_sponsor_contract_id,
    v_parent_id,
    p_position
  );
  
  -- Atualizar referência de filho no pai
  IF p_position = 'left' THEN
    UPDATE public.partner_binary_positions 
    SET left_child_id = p_contract_id, updated_at = timezone('America/Sao_Paulo', now())
    WHERE partner_contract_id = v_parent_id;
  ELSE
    UPDATE public.partner_binary_positions 
    SET right_child_id = p_contract_id, updated_at = timezone('America/Sao_Paulo', now())
    WHERE partner_contract_id = v_parent_id;
  END IF;
  
  -- Limpar pendência se existir
  UPDATE public.partner_binary_positions
  SET pending_position_for = NULL, pending_position_expires_at = NULL
  WHERE partner_contract_id = p_sponsor_contract_id AND pending_position_for = p_contract_id;
  
  -- GUARD: Se o contrato é demo, posiciona na árvore mas NÃO propaga pontos
  SELECT is_demo INTO v_is_demo FROM public.partner_contracts WHERE id = p_contract_id;
  
  IF COALESCE(v_is_demo, false) THEN
    RETURN jsonb_build_object(
      'success', true, 
      'parent_contract_id', v_parent_id,
      'position', p_position,
      'points_propagated', 0,
      'is_demo', true
    );
  END IF;
  
  -- Buscar pontos do plano
  SELECT plan_name INTO v_plan_name FROM public.partner_contracts WHERE id = p_contract_id;
  
  SELECT COALESCE(points, 0) INTO v_points 
  FROM public.partner_level_points 
  WHERE UPPER(plan_name) = UPPER(v_plan_name);
  
  IF v_points IS NULL THEN v_points := 0; END IF;
  
  -- Propagar pontos para uplines (agora passando o sponsor)
  IF v_points > 0 THEN
    PERFORM public.propagate_binary_points(p_contract_id, v_points, 'new_partner', p_sponsor_contract_id);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'parent_contract_id', v_parent_id,
    'position', p_position,
    'points_propagated', v_points
  );
END;
$$;
