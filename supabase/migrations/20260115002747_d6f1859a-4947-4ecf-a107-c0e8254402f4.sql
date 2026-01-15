-- =====================================================
-- Função para correção retroativa de indicações de parceiros
-- que não tiveram o referred_by_user_id preenchido corretamente
-- =====================================================

-- Primeiro, criar uma função reutilizável para processar bônus de indicação
-- (refatorando a lógica do trigger para ser reutilizável)
CREATE OR REPLACE FUNCTION process_partner_referral_bonus(
  p_referred_contract_id UUID,
  p_referrer_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referred_contract RECORD;
  v_referrer_contract RECORD;
  v_current_referrer_contract_id UUID;
  v_current_level INT := 1;
  v_max_levels INT := 3;
  v_level_config RECORD;
  v_bonus_value NUMERIC;
  v_bonuses_created INT := 0;
  v_result JSON;
BEGIN
  -- Buscar dados do contrato indicado
  SELECT * INTO v_referred_contract
  FROM partner_contracts
  WHERE id = p_referred_contract_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Contrato indicado não encontrado');
  END IF;

  -- Buscar contrato do primeiro indicador (nível 1)
  SELECT * INTO v_referrer_contract
  FROM partner_contracts
  WHERE user_id = p_referrer_user_id
    AND status = 'ACTIVE'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Contrato do indicador não encontrado ou inativo');
  END IF;

  v_current_referrer_contract_id := v_referrer_contract.id;

  -- Loop pelos níveis de indicação (até 3)
  WHILE v_current_level <= v_max_levels AND v_current_referrer_contract_id IS NOT NULL LOOP
    -- Buscar configuração do nível
    SELECT * INTO v_level_config
    FROM referral_level_config
    WHERE level = v_current_level
      AND is_active = true;
    
    -- Se não encontrar config, usar percentual padrão
    IF NOT FOUND THEN
      v_level_config.percentage := CASE v_current_level
        WHEN 1 THEN 10.0
        WHEN 2 THEN 5.0
        WHEN 3 THEN 2.5
        ELSE 0
      END;
    END IF;

    -- Buscar contrato atual do referrer neste nível
    SELECT * INTO v_referrer_contract
    FROM partner_contracts
    WHERE id = v_current_referrer_contract_id;
    
    IF NOT FOUND OR v_referrer_contract.status != 'ACTIVE' THEN
      EXIT; -- Sair se não encontrar contrato ativo
    END IF;

    -- Verificar se já existe bônus para evitar duplicação
    IF NOT EXISTS (
      SELECT 1 FROM partner_referral_bonuses
      WHERE referred_contract_id = p_referred_contract_id
        AND referrer_contract_id = v_current_referrer_contract_id
        AND referral_level = v_current_level
    ) THEN
      -- Calcular valor do bônus
      v_bonus_value := (v_referred_contract.aporte_value * v_level_config.percentage) / 100;
      
      -- Inserir bônus
      INSERT INTO partner_referral_bonuses (
        referrer_contract_id,
        referred_contract_id,
        referred_user_id,
        referral_level,
        aporte_value,
        bonus_percentage,
        bonus_value,
        status,
        available_at
      ) VALUES (
        v_current_referrer_contract_id,
        p_referred_contract_id,
        v_referred_contract.user_id,
        v_current_level,
        v_referred_contract.aporte_value,
        v_level_config.percentage,
        v_bonus_value,
        'PENDING',
        NOW() + INTERVAL '7 days'
      );
      
      v_bonuses_created := v_bonuses_created + 1;

      -- Atualizar pontos de indicação do referrer
      UPDATE partner_contracts
      SET total_referral_points = total_referral_points + 
          COALESCE((SELECT points FROM partner_level_points WHERE plan_name = v_referred_contract.plan_name), 0)
      WHERE id = v_current_referrer_contract_id
        AND v_current_level = 1; -- Só adiciona pontos no nível 1
    END IF;

    -- Buscar próximo nível (quem indicou o indicador atual)
    SELECT referred_by_user_id INTO v_current_referrer_contract_id
    FROM partner_contracts
    WHERE id = v_current_referrer_contract_id;
    
    -- Se encontrou um user_id, buscar o contrato dele
    IF v_current_referrer_contract_id IS NOT NULL THEN
      SELECT id INTO v_current_referrer_contract_id
      FROM partner_contracts
      WHERE user_id = v_current_referrer_contract_id
        AND status = 'ACTIVE'
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
    
    v_current_level := v_current_level + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'bonuses_created', v_bonuses_created,
    'message', format('Criados %s bônus de indicação', v_bonuses_created)
  );
END;
$$;

-- Função administrativa para corrigir indicações perdidas
CREATE OR REPLACE FUNCTION fix_partner_referral(
  p_referred_contract_id UUID,
  p_referral_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_contract RECORD;
  v_referred_contract RECORD;
  v_result JSON;
BEGIN
  -- Normalizar código
  p_referral_code := UPPER(TRIM(p_referral_code));
  
  -- Buscar contrato indicado
  SELECT * INTO v_referred_contract
  FROM partner_contracts
  WHERE id = p_referred_contract_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Contrato indicado não encontrado');
  END IF;
  
  -- Verificar se já tem referred_by_user_id
  IF v_referred_contract.referred_by_user_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Contrato já possui indicador registrado',
      'current_referrer', v_referred_contract.referred_by_user_id
    );
  END IF;
  
  -- Buscar contrato do indicador pelo código
  SELECT * INTO v_referrer_contract
  FROM partner_contracts
  WHERE referral_code = p_referral_code
    AND status = 'ACTIVE';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Código de indicação não encontrado ou inativo: ' || p_referral_code);
  END IF;
  
  -- Verificar se não é auto-referência
  IF v_referrer_contract.user_id = v_referred_contract.user_id THEN
    RETURN json_build_object('success', false, 'error', 'Não é permitido auto-indicação');
  END IF;
  
  -- Atualizar o referred_by_user_id no contrato indicado
  UPDATE partner_contracts
  SET referred_by_user_id = v_referrer_contract.user_id,
      updated_at = NOW()
  WHERE id = p_referred_contract_id;
  
  -- Processar bônus de indicação
  SELECT process_partner_referral_bonus(p_referred_contract_id, v_referrer_contract.user_id)
  INTO v_result;
  
  RETURN json_build_object(
    'success', true,
    'referred_contract_id', p_referred_contract_id,
    'referrer_user_id', v_referrer_contract.user_id,
    'referrer_contract_id', v_referrer_contract.id,
    'bonus_result', v_result
  );
END;
$$;

-- Executar o backfill do caso específico (Binário 2 indicado por Richard)
-- Contrato do indicado: 15cd36ba-5342-4714-9597-85a1f68f566f
-- Código do indicador: O01F9CG5
SELECT fix_partner_referral(
  '15cd36ba-5342-4714-9597-85a1f68f566f'::UUID,
  'O01F9CG5'
);