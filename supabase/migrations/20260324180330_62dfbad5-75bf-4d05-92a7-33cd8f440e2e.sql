
-- 1) Add max_cotas to partner_plans
ALTER TABLE public.partner_plans ADD COLUMN IF NOT EXISTS max_cotas INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.partner_plans ADD COLUMN IF NOT EXISTS monthly_return_cap NUMERIC NOT NULL DEFAULT 0.10;
ALTER TABLE public.partner_plans ADD COLUMN IF NOT EXISTS total_return_cap NUMERIC NOT NULL DEFAULT 2.0;

-- 2) Add cotas to partner_contracts and partner_payment_intents
ALTER TABLE public.partner_contracts ADD COLUMN IF NOT EXISTS cotas INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.partner_payment_intents ADD COLUMN IF NOT EXISTS cotas INTEGER NOT NULL DEFAULT 1;

-- 3) Set max_cotas = 3 for Legend
UPDATE public.partner_plans SET max_cotas = 3 WHERE UPPER(name) = 'LEGEND';

-- 4) Update position_partner_binary to multiply points by cotas
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
  v_cotas INTEGER;
BEGIN
  IF p_position NOT IN ('left', 'right') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posição inválida. Use left ou right.');
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.partner_binary_positions WHERE partner_contract_id = p_contract_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parceiro já está posicionado na árvore.');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.partner_binary_positions WHERE partner_contract_id = p_sponsor_contract_id) THEN
    INSERT INTO public.partner_binary_positions (partner_contract_id)
    VALUES (p_sponsor_contract_id);
  END IF;
  
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
  
  IF p_position = 'left' THEN
    UPDATE public.partner_binary_positions 
    SET left_child_id = p_contract_id, updated_at = timezone('America/Sao_Paulo', now())
    WHERE partner_contract_id = v_parent_id;
  ELSE
    UPDATE public.partner_binary_positions 
    SET right_child_id = p_contract_id, updated_at = timezone('America/Sao_Paulo', now())
    WHERE partner_contract_id = v_parent_id;
  END IF;
  
  UPDATE public.partner_binary_positions
  SET pending_position_for = NULL, pending_position_expires_at = NULL
  WHERE partner_contract_id = p_sponsor_contract_id AND pending_position_for = p_contract_id;
  
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
  
  -- COTAS: multiplicar pontos pelo número de cotas
  SELECT COALESCE(pc.cotas, 1) INTO v_cotas FROM public.partner_contracts pc WHERE pc.id = p_contract_id;
  v_points := v_points * v_cotas;
  
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
