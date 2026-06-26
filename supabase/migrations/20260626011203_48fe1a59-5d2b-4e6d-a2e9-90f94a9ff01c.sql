CREATE OR REPLACE FUNCTION public.reverse_orphan_binary_points(p_contract_id uuid, p_leg text, p_reason_note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_name text;
  v_orphan integer := 0;
  v_child uuid;
  v_log_id uuid;
  v_partner_name text;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_admin_user(v_admin_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  IF p_leg NOT IN ('left','right') THEN
    RAISE EXCEPTION 'Parâmetro leg inválido: %', p_leg;
  END IF;

  IF p_reason_note IS NULL OR length(btrim(p_reason_note)) < 10 THEN
    RAISE EXCEPTION 'É obrigatório informar um motivo com pelo menos 10 caracteres.';
  END IF;

  IF p_leg = 'left' THEN
    SELECT left_points, left_child_id INTO v_orphan, v_child
    FROM partner_binary_positions WHERE partner_contract_id = p_contract_id FOR UPDATE;
  ELSE
    SELECT right_points, right_child_id INTO v_orphan, v_child
    FROM partner_binary_positions WHERE partner_contract_id = p_contract_id FOR UPDATE;
  END IF;

  IF v_orphan IS NULL THEN
    RAISE EXCEPTION 'Contrato % não possui posição binária.', p_contract_id;
  END IF;
  IF v_child IS NOT NULL THEN
    RAISE EXCEPTION 'O lado % possui filho cadastrado. Pontos não são órfãos.', p_leg;
  END IF;
  IF v_orphan <= 0 THEN
    RAISE EXCEPTION 'Não há pontos a estornar no lado %.', p_leg;
  END IF;

  INSERT INTO binary_points_log (partner_contract_id, source_contract_id, points_added, position, reason)
  VALUES (p_contract_id, p_contract_id, -v_orphan, p_leg, 'orphan_reversal')
  RETURNING id INTO v_log_id;

  IF p_leg = 'left' THEN
    UPDATE partner_binary_positions
    SET left_points = GREATEST(left_points - v_orphan, 0),
        total_left_points = GREATEST(total_left_points - v_orphan, 0),
        updated_at = now()
    WHERE partner_contract_id = p_contract_id;
  ELSE
    UPDATE partner_binary_positions
    SET right_points = GREATEST(right_points - v_orphan, 0),
        total_right_points = GREATEST(total_right_points - v_orphan, 0),
        updated_at = now()
    WHERE partner_contract_id = p_contract_id;
  END IF;

  SELECT full_name INTO v_admin_name FROM profiles WHERE user_id = v_admin_id;
  SELECT pr.full_name INTO v_partner_name
    FROM partner_contracts pc LEFT JOIN profiles pr ON pr.user_id = pc.user_id
    WHERE pc.id = p_contract_id;

  INSERT INTO admin_audit_log (admin_user_id, admin_name, action_type, target_type, target_id, new_values, description)
  VALUES (v_admin_id, COALESCE(v_admin_name, 'admin'), 'binary_orphan_reversal', 'partner_contract', p_contract_id,
    jsonb_build_object('leg', p_leg, 'amount', v_orphan, 'note', p_reason_note, 'log_id', v_log_id),
    format('Estorno de %s pts órfãos do lado %s do parceiro %s. Motivo: %s', v_orphan, p_leg, COALESCE(v_partner_name,'?'), p_reason_note));

  RETURN jsonb_build_object('success', true, 'reversed_amount', v_orphan, 'log_id', v_log_id);
END;
$function$;