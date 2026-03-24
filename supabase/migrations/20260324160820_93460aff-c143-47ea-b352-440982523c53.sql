-- 1) Recriar propagate_binary_points SEM a regra de qualificador
CREATE OR REPLACE FUNCTION public.propagate_binary_points(
  p_source_contract_id UUID,
  p_points INTEGER,
  p_reason TEXT DEFAULT 'new_partner',
  p_sponsor_contract_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_id UUID;
  v_current_position TEXT;
  v_parent_id UUID;
  v_total_propagated INTEGER := 0;
  v_is_demo BOOLEAN;
BEGIN
  SELECT pc.is_demo INTO v_is_demo
  FROM partner_contracts pc
  WHERE pc.id = p_source_contract_id;

  IF v_is_demo IS TRUE THEN
    RAISE NOTICE '[propagate_binary_points] Source contract % is demo — skipping propagation', p_source_contract_id;
    RETURN 0;
  END IF;

  SELECT parent_contract_id, position
  INTO v_parent_id, v_current_position
  FROM partner_binary_positions
  WHERE partner_contract_id = p_source_contract_id;

  IF v_parent_id IS NULL THEN
    RETURN 0;
  END IF;

  v_current_id := v_parent_id;

  WHILE v_current_id IS NOT NULL LOOP
    IF v_current_position = 'left' THEN
      UPDATE partner_binary_positions
      SET left_points = left_points + p_points,
          total_left_points = total_left_points + p_points,
          updated_at = timezone('America/Sao_Paulo', now())
      WHERE partner_contract_id = v_current_id;
    ELSIF v_current_position = 'right' THEN
      UPDATE partner_binary_positions
      SET right_points = right_points + p_points,
          total_right_points = total_right_points + p_points,
          updated_at = timezone('America/Sao_Paulo', now())
      WHERE partner_contract_id = v_current_id;
    END IF;

    INSERT INTO binary_points_log (partner_contract_id, source_contract_id, points_added, position, reason)
    VALUES (v_current_id, p_source_contract_id, p_points, v_current_position, p_reason);

    v_total_propagated := v_total_propagated + p_points;

    SELECT parent_contract_id, position
    INTO v_parent_id, v_current_position
    FROM partner_binary_positions
    WHERE partner_contract_id = v_current_id;

    v_current_id := v_parent_id;
  END LOOP;

  RETURN v_total_propagated;
END;
$$;

-- 2) Correção retroativa: adicionar 600 pontos na perna direita do Luis Paulo
UPDATE partner_binary_positions
SET right_points = right_points + 600,
    total_right_points = total_right_points + 600,
    updated_at = timezone('America/Sao_Paulo', now())
WHERE partner_contract_id = 'f54fe7ca-bc23-4db8-b4cb-39ead3d4a1e8';

-- 3) Registrar no log
INSERT INTO binary_points_log (partner_contract_id, source_contract_id, points_added, position, reason)
VALUES ('f54fe7ca-bc23-4db8-b4cb-39ead3d4a1e8', 'c7627efd-b8f1-44a4-86ed-4481846ded31', 600, 'right', 'retroactive_fix_qualifier_rule');