
-- Recriar propagate_binary_points com parametro opcional p_sponsor_contract_id
CREATE OR REPLACE FUNCTION public.propagate_binary_points(
  p_source_contract_id UUID,
  p_points INTEGER,
  p_reason TEXT,
  p_sponsor_contract_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_id UUID;
  v_parent_id UUID;
  v_position TEXT;
  v_propagation_count INTEGER := 0;
  v_skip_points BOOLEAN;
  v_direct_referrals_count INTEGER;
BEGIN
  -- Encontrar a posição do contrato fonte
  SELECT parent_contract_id, position INTO v_parent_id, v_position
  FROM public.partner_binary_positions 
  WHERE partner_contract_id = p_source_contract_id;
  
  -- Se não tem pai, não há o que propagar
  IF v_parent_id IS NULL THEN
    RETURN 0;
  END IF;
  
  v_current_id := p_source_contract_id;
  
  -- Subir na árvore propagando pontos
  WHILE v_parent_id IS NOT NULL LOOP
    v_skip_points := false;
    
    -- Verificar se este upline é o sponsor direto
    IF p_sponsor_contract_id IS NOT NULL AND v_parent_id = p_sponsor_contract_id THEN
      -- Contar indicados diretos deste sponsor
      SELECT COUNT(*) INTO v_direct_referrals_count
      FROM public.partner_binary_positions
      WHERE sponsor_contract_id = v_parent_id;
      
      -- Se tem 2 ou menos indicados, este ainda é qualificador - pular pontos
      IF v_direct_referrals_count <= 2 THEN
        v_skip_points := true;
      END IF;
    END IF;
    
    IF NOT v_skip_points THEN
      -- Atualizar pontos do pai baseado na posição do filho
      IF v_position = 'left' THEN
        UPDATE public.partner_binary_positions 
        SET left_points = left_points + p_points,
            total_left_points = total_left_points + p_points,
            updated_at = timezone('America/Sao_Paulo', now())
        WHERE partner_contract_id = v_parent_id;
      ELSE
        UPDATE public.partner_binary_positions 
        SET right_points = right_points + p_points,
            total_right_points = total_right_points + p_points,
            updated_at = timezone('America/Sao_Paulo', now())
        WHERE partner_contract_id = v_parent_id;
      END IF;
    END IF;
    
    -- Registrar no log (mesmo se pulou pontos para o sponsor)
    INSERT INTO public.binary_points_log (partner_contract_id, source_contract_id, points_added, position, reason)
    VALUES (v_parent_id, p_source_contract_id, CASE WHEN v_skip_points THEN 0 ELSE p_points END, v_position, 
            CASE WHEN v_skip_points THEN p_reason || '_qualifier_skip' ELSE p_reason END);
    
    v_propagation_count := v_propagation_count + 1;
    
    -- Mover para o próximo nível (SEMPRE continuar subindo)
    v_current_id := v_parent_id;
    
    SELECT parent_contract_id, position INTO v_parent_id, v_position
    FROM public.partner_binary_positions 
    WHERE partner_contract_id = v_current_id;
  END LOOP;
  
  RETURN v_propagation_count;
END;
$$;

-- Recriar position_partner_binary para passar o sponsor_contract_id
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
