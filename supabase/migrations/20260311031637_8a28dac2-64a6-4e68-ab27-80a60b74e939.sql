
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
  v_sponsor_id UUID;
  v_total_propagated INTEGER := 0;
  v_is_demo BOOLEAN;
  v_is_qualifier BOOLEAN;
BEGIN
  -- Guard: if source contract is demo, do NOT propagate points
  SELECT pc.is_demo INTO v_is_demo
  FROM partner_contracts pc
  WHERE pc.id = p_source_contract_id;

  IF v_is_demo IS TRUE THEN
    RAISE NOTICE '[propagate_binary_points] Source contract % is demo — skipping propagation', p_source_contract_id;
    RETURN 0;
  END IF;

  -- Get the position record of the source contract
  SELECT parent_contract_id, position, sponsor_contract_id
  INTO v_parent_id, v_current_position, v_sponsor_id
  FROM partner_binary_positions
  WHERE partner_contract_id = p_source_contract_id;

  IF v_parent_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Use provided sponsor or the one from the position record
  IF p_sponsor_contract_id IS NOT NULL THEN
    v_sponsor_id := p_sponsor_contract_id;
  END IF;

  v_current_id := v_parent_id;

  WHILE v_current_id IS NOT NULL LOOP
    -- Check if this ancestor is the direct sponsor (qualifier rule)
    v_is_qualifier := (v_current_id = v_sponsor_id);

    IF NOT v_is_qualifier THEN
      -- Add points to the correct side
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

      -- Log
      INSERT INTO binary_points_log (partner_contract_id, source_contract_id, points_added, position, reason)
      VALUES (v_current_id, p_source_contract_id, p_points, v_current_position, p_reason);

      v_total_propagated := v_total_propagated + p_points;
    END IF;

    -- Move up
    SELECT parent_contract_id, position
    INTO v_parent_id, v_current_position
    FROM partner_binary_positions
    WHERE partner_contract_id = v_current_id;

    v_current_id := v_parent_id;
  END LOOP;

  RETURN v_total_propagated;
END;
$$;
