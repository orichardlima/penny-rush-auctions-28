
-- Recriar close_binary_cycle com filtro de ativação binária
CREATE OR REPLACE FUNCTION public.close_binary_cycle(p_admin_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cycle_id UUID;
  v_cycle_number INTEGER;
  v_bonus_percentage NUMERIC;
  v_point_value NUMERIC;
  v_total_matched INTEGER := 0;
  v_total_bonus NUMERIC := 0;
  v_partners_count INTEGER := 0;
  v_partner RECORD;
  v_matched INTEGER;
  v_bonus NUMERIC;
  v_left_remaining INTEGER;
  v_right_remaining INTEGER;
BEGIN
  SELECT COALESCE(setting_value::NUMERIC, 10) INTO v_bonus_percentage
  FROM public.system_settings WHERE setting_key = 'binary_bonus_percentage';
  
  SELECT COALESCE(setting_value::NUMERIC, 1) INTO v_point_value
  FROM public.system_settings WHERE setting_key = 'binary_point_value';
  
  SELECT COALESCE(MAX(cycle_number), 0) + 1 INTO v_cycle_number
  FROM public.binary_cycle_closures;
  
  INSERT INTO public.binary_cycle_closures (cycle_number, closed_by, bonus_percentage, point_value, notes)
  VALUES (v_cycle_number, p_admin_id, v_bonus_percentage, v_point_value, p_notes)
  RETURNING id INTO v_cycle_id;
  
  FOR v_partner IN
    SELECT partner_contract_id, left_points, right_points
    FROM public.partner_binary_positions
    WHERE (left_points > 0 OR right_points > 0)
      AND left_child_id IS NOT NULL
      AND right_child_id IS NOT NULL
  LOOP
    v_matched := LEAST(v_partner.left_points, v_partner.right_points);
    
    IF v_matched > 0 THEN
      v_bonus := v_matched * v_point_value * (v_bonus_percentage / 100);
      v_left_remaining := v_partner.left_points - v_matched;
      v_right_remaining := v_partner.right_points - v_matched;
      
      INSERT INTO public.binary_bonuses (
        cycle_closure_id, partner_contract_id,
        left_points_before, right_points_before,
        matched_points, bonus_percentage, point_value, bonus_value,
        left_points_remaining, right_points_remaining,
        status, available_at
      ) VALUES (
        v_cycle_id, v_partner.partner_contract_id,
        v_partner.left_points, v_partner.right_points,
        v_matched, v_bonus_percentage, v_point_value, v_bonus,
        v_left_remaining, v_right_remaining,
        'AVAILABLE', timezone('America/Sao_Paulo', now())
      );
      
      UPDATE public.partner_binary_positions
      SET left_points = v_left_remaining,
          right_points = v_right_remaining,
          updated_at = timezone('America/Sao_Paulo', now())
      WHERE partner_contract_id = v_partner.partner_contract_id;
      
      UPDATE public.partner_contracts
      SET available_balance = available_balance + v_bonus,
          updated_at = timezone('America/Sao_Paulo', now())
      WHERE id = v_partner.partner_contract_id;
      
      v_total_matched := v_total_matched + v_matched;
      v_total_bonus := v_total_bonus + v_bonus;
      v_partners_count := v_partners_count + 1;
    END IF;
  END LOOP;
  
  UPDATE public.binary_cycle_closures
  SET total_points_matched = v_total_matched,
      total_bonus_distributed = v_total_bonus,
      partners_count = v_partners_count
  WHERE id = v_cycle_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'cycle_id', v_cycle_id,
    'cycle_number', v_cycle_number,
    'partners_count', v_partners_count,
    'total_points_matched', v_total_matched,
    'total_bonus_distributed', v_total_bonus,
    'bonus_percentage', v_bonus_percentage,
    'point_value', v_point_value
  );
END;
$function$;

-- Recriar preview_binary_cycle_closure com filtro de ativação binária
CREATE OR REPLACE FUNCTION public.preview_binary_cycle_closure()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_bonus_percentage NUMERIC;
  v_point_value NUMERIC;
  v_total_matched INTEGER := 0;
  v_total_bonus NUMERIC := 0;
  v_partners_count INTEGER := 0;
  v_preview JSONB := '[]'::JSONB;
  v_partner RECORD;
  v_matched INTEGER;
  v_bonus NUMERIC;
BEGIN
  SELECT COALESCE(setting_value::NUMERIC, 10) INTO v_bonus_percentage
  FROM public.system_settings WHERE setting_key = 'binary_bonus_percentage';
  
  SELECT COALESCE(setting_value::NUMERIC, 1) INTO v_point_value
  FROM public.system_settings WHERE setting_key = 'binary_point_value';
  
  FOR v_partner IN
    SELECT 
      bp.partner_contract_id, 
      bp.left_points, 
      bp.right_points,
      p.full_name,
      pc.plan_name
    FROM public.partner_binary_positions bp
    JOIN public.partner_contracts pc ON pc.id = bp.partner_contract_id
    JOIN public.profiles p ON p.user_id = pc.user_id
    WHERE (bp.left_points > 0 OR bp.right_points > 0)
      AND bp.left_child_id IS NOT NULL
      AND bp.right_child_id IS NOT NULL
    ORDER BY LEAST(bp.left_points, bp.right_points) DESC
  LOOP
    v_matched := LEAST(v_partner.left_points, v_partner.right_points);
    
    IF v_matched > 0 THEN
      v_bonus := v_matched * v_point_value * (v_bonus_percentage / 100);
      
      v_preview := v_preview || jsonb_build_object(
        'partner_contract_id', v_partner.partner_contract_id,
        'partner_name', v_partner.full_name,
        'plan_name', v_partner.plan_name,
        'left_points', v_partner.left_points,
        'right_points', v_partner.right_points,
        'matched_points', v_matched,
        'bonus_value', v_bonus,
        'left_remaining', v_partner.left_points - v_matched,
        'right_remaining', v_partner.right_points - v_matched
      );
      
      v_total_matched := v_total_matched + v_matched;
      v_total_bonus := v_total_bonus + v_bonus;
      v_partners_count := v_partners_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'bonus_percentage', v_bonus_percentage,
    'point_value', v_point_value,
    'partners_count', v_partners_count,
    'total_points_matched', v_total_matched,
    'total_bonus_to_distribute', v_total_bonus,
    'partners', v_preview
  );
END;
$function$;
