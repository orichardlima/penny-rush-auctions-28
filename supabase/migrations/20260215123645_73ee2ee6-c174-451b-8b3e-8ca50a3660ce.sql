
DROP FUNCTION IF EXISTS public.position_partner_binary(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.position_partner_binary(
  p_contract_id UUID,
  p_sponsor_contract_id UUID,
  p_position TEXT
)
RETURNS jsonb
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
    -- Posição direta disponível
    v_parent_id := p_sponsor_contract_id;
  ELSE
    -- Posição ocupada: descer sempre pela MESMA direção até a EXTREMIDADE
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
        -- p_position permanece o mesmo (left ou right) - extremidade
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
  
  -- Propagar pontos para uplines
  IF v_points > 0 THEN
    PERFORM public.propagate_binary_points(p_contract_id, v_points, 'new_partner');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'parent_contract_id', v_parent_id,
    'position', p_position,
    'points_propagated', v_points
  );
END;
$$;
