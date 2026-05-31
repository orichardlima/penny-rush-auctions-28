
-- =====================================================
-- Atualiza partner_request_leave_sponsor
-- =====================================================
CREATE OR REPLACE FUNCTION public.partner_request_leave_sponsor(p_contract_id uuid, p_reason text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_elig jsonb;
  v_old_sponsor_user_id uuid;
  v_old_sponsor_contract_id uuid;
  v_old_position RECORD;
  v_cancelled_count int := 0; v_cancelled_total numeric := 0;
  v_reversed_count int := 0;  v_reversed_total numeric := 0;
  v_bonus RECORD;
  v_exit_id uuid;
BEGIN
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF v_contract.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: apenas o dono do contrato pode solicitar a saída';
  END IF;

  v_elig := partner_check_leave_eligibility(p_contract_id);
  IF NOT (v_elig->>'eligible')::boolean THEN
    RAISE EXCEPTION 'Não elegível: %', v_elig->>'reason';
  END IF;

  v_old_sponsor_user_id := v_contract.referred_by_user_id;
  SELECT id INTO v_old_sponsor_contract_id FROM partner_contracts
   WHERE user_id = v_old_sponsor_user_id AND status='ACTIVE'
   ORDER BY created_at ASC LIMIT 1;

  -- Conjunto: contrato que está saindo + todos os descendentes (via referred_by_user_id)
  WITH RECURSIVE descendants(id, user_id) AS (
    SELECT id, user_id FROM partner_contracts WHERE id = p_contract_id
    UNION
    SELECT c.id, c.user_id
      FROM partner_contracts c
      JOIN descendants d ON c.referred_by_user_id = d.user_id
  ),
  cancelled AS (
    UPDATE partner_referral_bonuses b
    SET status = 'CANCELLED'
    WHERE b.referred_contract_id IN (SELECT id FROM descendants)
      AND b.status = 'PENDING'
    RETURNING bonus_value
  )
  SELECT COUNT(*), COALESCE(SUM(bonus_value),0)
  INTO v_cancelled_count, v_cancelled_total FROM cancelled;

  FOR v_bonus IN
    WITH RECURSIVE descendants(id, user_id) AS (
      SELECT id, user_id FROM partner_contracts WHERE id = p_contract_id
      UNION
      SELECT c.id, c.user_id
        FROM partner_contracts c
        JOIN descendants d ON c.referred_by_user_id = d.user_id
    )
    SELECT b.id, b.bonus_value, b.referrer_contract_id
    FROM partner_referral_bonuses b
    WHERE b.referred_contract_id IN (SELECT id FROM descendants)
      AND b.status = 'AVAILABLE'
      AND b.paid_at IS NULL
  LOOP
    UPDATE partner_referral_bonuses SET status='CANCELLED' WHERE id = v_bonus.id;
    UPDATE partner_contracts
       SET available_balance = GREATEST(0, available_balance - v_bonus.bonus_value),
           updated_at = now()
     WHERE id = v_bonus.referrer_contract_id;
    UPDATE partner_payouts
       SET status = 'CANCELLED'
     WHERE referral_bonus_id = v_bonus.id
       AND status IN ('PAID','PENDING');
    v_reversed_count := v_reversed_count + 1;
    v_reversed_total := v_reversed_total + v_bonus.bonus_value;
  END LOOP;

  SELECT * INTO v_old_position FROM partner_binary_positions
   WHERE partner_contract_id = p_contract_id;

  IF FOUND AND v_old_position.parent_contract_id IS NOT NULL THEN
    UPDATE partner_binary_positions
    SET left_child_id  = CASE WHEN left_child_id  = p_contract_id THEN NULL ELSE left_child_id END,
        right_child_id = CASE WHEN right_child_id = p_contract_id THEN NULL ELSE right_child_id END,
        updated_at = now()
    WHERE partner_contract_id = v_old_position.parent_contract_id;

    UPDATE partner_binary_positions
    SET parent_contract_id = NULL,
        sponsor_contract_id = NULL,
        position = NULL,
        updated_at = now()
    WHERE partner_contract_id = p_contract_id;
  END IF;

  UPDATE partner_contracts
     SET referred_by_user_id = NULL, updated_at = now()
   WHERE id = p_contract_id;

  INSERT INTO partner_network_exits(
    partner_contract_id, partner_user_id,
    old_sponsor_user_id, old_sponsor_contract_id,
    old_binary_parent_contract_id, old_binary_position,
    status, cancelled_pending_count, cancelled_pending_total,
    reversed_available_count, reversed_available_total,
    reason, ip_address
  ) VALUES (
    p_contract_id, v_contract.user_id,
    v_old_sponsor_user_id, v_old_sponsor_contract_id,
    v_old_position.parent_contract_id, v_old_position.position,
    'IN_TRANSIT', v_cancelled_count, v_cancelled_total,
    v_reversed_count, v_reversed_total,
    p_reason, p_ip
  ) RETURNING id INTO v_exit_id;

  INSERT INTO admin_audit_log(
    admin_user_id, admin_name, action_type, target_type, target_id,
    old_values, new_values, description
  ) VALUES (
    v_contract.user_id,
    COALESCE((SELECT full_name FROM profiles WHERE user_id=v_contract.user_id), 'Parceiro'),
    'PARTNER_SELF_LEAVE_NETWORK', 'partner_contract', p_contract_id,
    jsonb_build_object('old_sponsor_user_id', v_old_sponsor_user_id),
    jsonb_build_object(
      'cancelled_pending_count', v_cancelled_count,
      'cancelled_pending_total', v_cancelled_total,
      'reversed_available_count', v_reversed_count,
      'reversed_available_total', v_reversed_total,
      'exit_id', v_exit_id
    ),
    'Parceiro solicitou saída da rede (inclui sub-rede descendente)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'exit_id', v_exit_id,
    'cancelled_pending_count', v_cancelled_count,
    'cancelled_pending_total', v_cancelled_total,
    'reversed_available_count', v_reversed_count,
    'reversed_available_total', v_reversed_total
  );
END;
$function$;

-- =====================================================
-- Atualiza partner_leave_sponsor_network
-- =====================================================
CREATE OR REPLACE FUNCTION public.partner_leave_sponsor_network(p_contract_id uuid, p_reason text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_elig jsonb;
  v_old_sponsor_user_id uuid;
  v_old_sponsor_contract_id uuid;
  v_old_position RECORD;
  v_cancelled_count int := 0; v_cancelled_total numeric := 0;
  v_reversed_count int := 0;  v_reversed_total numeric := 0;
  v_bonus RECORD;
  v_exit_id uuid;
BEGIN
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF v_contract.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: apenas o dono do contrato pode solicitar a saída';
  END IF;

  v_elig := partner_check_leave_eligibility(p_contract_id);
  IF NOT (v_elig->>'eligible')::boolean THEN
    RAISE EXCEPTION 'Não elegível: %', v_elig->>'reason';
  END IF;

  v_old_sponsor_user_id := v_contract.referred_by_user_id;
  SELECT id INTO v_old_sponsor_contract_id FROM partner_contracts
   WHERE user_id = v_old_sponsor_user_id AND status='ACTIVE'
   ORDER BY created_at ASC LIMIT 1;

  WITH RECURSIVE descendants(id, user_id) AS (
    SELECT id, user_id FROM partner_contracts WHERE id = p_contract_id
    UNION
    SELECT c.id, c.user_id
      FROM partner_contracts c
      JOIN descendants d ON c.referred_by_user_id = d.user_id
  ),
  cancelled AS (
    UPDATE partner_referral_bonuses b
    SET status = 'CANCELLED'
    WHERE b.referred_contract_id IN (SELECT id FROM descendants)
      AND b.status = 'PENDING'
    RETURNING bonus_value
  )
  SELECT COUNT(*), COALESCE(SUM(bonus_value),0)
  INTO v_cancelled_count, v_cancelled_total FROM cancelled;

  FOR v_bonus IN
    WITH RECURSIVE descendants(id, user_id) AS (
      SELECT id, user_id FROM partner_contracts WHERE id = p_contract_id
      UNION
      SELECT c.id, c.user_id
        FROM partner_contracts c
        JOIN descendants d ON c.referred_by_user_id = d.user_id
    )
    SELECT b.id, b.bonus_value, b.referrer_contract_id
    FROM partner_referral_bonuses b
    WHERE b.referred_contract_id IN (SELECT id FROM descendants)
      AND b.status = 'AVAILABLE'
      AND b.paid_at IS NULL
  LOOP
    UPDATE partner_referral_bonuses SET status='CANCELLED' WHERE id = v_bonus.id;
    UPDATE partner_contracts
       SET available_balance = GREATEST(0, available_balance - v_bonus.bonus_value),
           updated_at = now()
     WHERE id = v_bonus.referrer_contract_id;
    UPDATE partner_payouts
       SET status = 'CANCELLED'
     WHERE referral_bonus_id = v_bonus.id
       AND status IN ('PAID','PENDING');
    v_reversed_count := v_reversed_count + 1;
    v_reversed_total := v_reversed_total + v_bonus.bonus_value;
  END LOOP;

  SELECT * INTO v_old_position FROM partner_binary_positions
   WHERE partner_contract_id = p_contract_id;

  IF FOUND AND v_old_position.parent_contract_id IS NOT NULL THEN
    UPDATE partner_binary_positions
    SET left_child_id  = CASE WHEN left_child_id  = p_contract_id THEN NULL ELSE left_child_id END,
        right_child_id = CASE WHEN right_child_id = p_contract_id THEN NULL ELSE right_child_id END,
        updated_at = now()
    WHERE partner_contract_id = v_old_position.parent_contract_id;

    UPDATE partner_binary_positions
    SET parent_contract_id = NULL,
        sponsor_contract_id = NULL,
        position = NULL,
        updated_at = now()
    WHERE partner_contract_id = p_contract_id;
  END IF;

  UPDATE partner_contracts
     SET referred_by_user_id = NULL, updated_at = now()
   WHERE id = p_contract_id;

  INSERT INTO partner_network_exits(
    partner_contract_id, partner_user_id,
    old_sponsor_user_id, old_sponsor_contract_id,
    old_binary_parent_contract_id, old_binary_position,
    status, cancelled_pending_count, cancelled_pending_total,
    reversed_available_count, reversed_available_total,
    reason, ip_address
  ) VALUES (
    p_contract_id, v_contract.user_id,
    v_old_sponsor_user_id, v_old_sponsor_contract_id,
    v_old_position.parent_contract_id, v_old_position.position,
    'IN_TRANSIT', v_cancelled_count, v_cancelled_total,
    v_reversed_count, v_reversed_total,
    p_reason, p_ip
  ) RETURNING id INTO v_exit_id;

  RETURN jsonb_build_object(
    'success', true,
    'exit_id', v_exit_id,
    'cancelled_pending_count', v_cancelled_count,
    'cancelled_pending_total', v_cancelled_total,
    'reversed_available_count', v_reversed_count,
    'reversed_available_total', v_reversed_total
  );
END;
$function$;

-- =====================================================
-- Atualiza admin_transfer_partner_sponsor
-- =====================================================
CREATE OR REPLACE FUNCTION public.admin_transfer_partner_sponsor(p_contract_id uuid, p_new_sponsor_user_id uuid, p_cancel_pending_bonuses boolean DEFAULT true, p_reverse_available_bonuses boolean DEFAULT false, p_remove_from_binary boolean DEFAULT false, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_old_sponsor_user_id uuid;
  v_admin_id uuid := auth.uid();
  v_admin_name text;
  v_cancelled_pending_count int := 0;
  v_cancelled_pending_total numeric := 0;
  v_reversed_available_count int := 0;
  v_reversed_available_total numeric := 0;
  v_bonus RECORD;
  v_old_position RECORD;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  IF NOT is_admin_user(v_admin_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores';
  END IF;

  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

  v_old_sponsor_user_id := v_contract.referred_by_user_id;
  SELECT COALESCE(full_name, 'Admin') INTO v_admin_name FROM profiles WHERE user_id = v_admin_id;

  v_old_values := jsonb_build_object(
    'referred_by_user_id', v_contract.referred_by_user_id
  );

  IF p_cancel_pending_bonuses AND v_old_sponsor_user_id IS NOT NULL THEN
    WITH RECURSIVE descendants(id, user_id) AS (
      SELECT id, user_id FROM partner_contracts WHERE id = p_contract_id
      UNION
      SELECT c.id, c.user_id
        FROM partner_contracts c
        JOIN descendants d ON c.referred_by_user_id = d.user_id
    ),
    cancelled AS (
      UPDATE partner_referral_bonuses b
      SET status = 'CANCELLED'
      WHERE b.referred_contract_id IN (SELECT id FROM descendants)
        AND b.status = 'PENDING'
      RETURNING bonus_value
    )
    SELECT COUNT(*), COALESCE(SUM(bonus_value),0)
    INTO v_cancelled_pending_count, v_cancelled_pending_total FROM cancelled;
  END IF;

  IF p_reverse_available_bonuses AND v_old_sponsor_user_id IS NOT NULL THEN
    FOR v_bonus IN
      WITH RECURSIVE descendants(id, user_id) AS (
        SELECT id, user_id FROM partner_contracts WHERE id = p_contract_id
        UNION
        SELECT c.id, c.user_id
          FROM partner_contracts c
          JOIN descendants d ON c.referred_by_user_id = d.user_id
      )
      SELECT b.id, b.bonus_value, b.referrer_contract_id
      FROM partner_referral_bonuses b
      WHERE b.referred_contract_id IN (SELECT id FROM descendants)
        AND b.status = 'AVAILABLE'
        AND b.paid_at IS NULL
    LOOP
      UPDATE partner_referral_bonuses SET status = 'CANCELLED' WHERE id = v_bonus.id;

      UPDATE partner_contracts
      SET available_balance = GREATEST(0, available_balance - v_bonus.bonus_value),
          updated_at = now()
      WHERE id = v_bonus.referrer_contract_id;

      UPDATE partner_payouts
         SET status = 'CANCELLED'
       WHERE referral_bonus_id = v_bonus.id
         AND status IN ('PAID','PENDING');

      v_reversed_available_count := v_reversed_available_count + 1;
      v_reversed_available_total := v_reversed_available_total + v_bonus.bonus_value;
    END LOOP;
  END IF;

  IF p_remove_from_binary THEN
    SELECT * INTO v_old_position FROM partner_binary_positions
    WHERE partner_contract_id = p_contract_id;

    IF FOUND AND v_old_position.parent_contract_id IS NOT NULL THEN
      UPDATE partner_binary_positions
      SET left_child_id = CASE WHEN left_child_id = p_contract_id THEN NULL ELSE left_child_id END,
          right_child_id = CASE WHEN right_child_id = p_contract_id THEN NULL ELSE right_child_id END,
          updated_at = now()
      WHERE partner_contract_id = v_old_position.parent_contract_id;

      UPDATE partner_binary_positions
      SET parent_contract_id = NULL,
          sponsor_contract_id = NULL,
          position = NULL,
          updated_at = now()
      WHERE partner_contract_id = p_contract_id;
    END IF;
  END IF;

  UPDATE partner_contracts
  SET referred_by_user_id = p_new_sponsor_user_id,
      updated_at = now()
  WHERE id = p_contract_id;

  v_new_values := jsonb_build_object(
    'referred_by_user_id', p_new_sponsor_user_id,
    'cancelled_pending_count', v_cancelled_pending_count,
    'cancelled_pending_total', v_cancelled_pending_total,
    'reversed_available_count', v_reversed_available_count,
    'reversed_available_total', v_reversed_available_total,
    'removed_from_binary', p_remove_from_binary
  );

  INSERT INTO admin_audit_log(
    admin_user_id, admin_name, action_type, target_type, target_id,
    old_values, new_values, description
  ) VALUES (
    v_admin_id, v_admin_name,
    'ADMIN_TRANSFER_PARTNER_SPONSOR', 'partner_contract', p_contract_id,
    v_old_values, v_new_values,
    COALESCE(p_reason, 'Transferência de patrocinador (inclui sub-rede descendente)')
  );

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_pending_count', v_cancelled_pending_count,
    'cancelled_pending_total', v_cancelled_pending_total,
    'reversed_available_count', v_reversed_available_count,
    'reversed_available_total', v_reversed_available_total
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_transfer_partner_sponsor(uuid, uuid, boolean, boolean, boolean, text) TO authenticated;

-- =====================================================
-- Backfill: aplica a regra retroativamente à saída da Sabriny
-- contract_id = abd3ffff-d7fc-4f18-beb6-ac55986cefba
-- =====================================================
DO $$
DECLARE
  v_contract_id uuid := 'abd3ffff-d7fc-4f18-beb6-ac55986cefba';
  v_bonus RECORD;
  v_reversed_count int := 0;
  v_reversed_total numeric := 0;
  v_cancelled_count int := 0;
  v_cancelled_total numeric := 0;
BEGIN
  -- Cancela bônus PENDING de descendentes
  WITH RECURSIVE descendants(id, user_id) AS (
    SELECT id, user_id FROM partner_contracts WHERE id = v_contract_id
    UNION
    SELECT c.id, c.user_id
      FROM partner_contracts c
      JOIN descendants d ON c.referred_by_user_id = d.user_id
  ),
  cancelled AS (
    UPDATE partner_referral_bonuses b
    SET status = 'CANCELLED'
    WHERE b.referred_contract_id IN (SELECT id FROM descendants WHERE id <> v_contract_id)
      AND b.status = 'PENDING'
    RETURNING bonus_value
  )
  SELECT COUNT(*), COALESCE(SUM(bonus_value),0)
  INTO v_cancelled_count, v_cancelled_total FROM cancelled;

  -- Reverte bônus AVAILABLE de descendentes (exclui o próprio contrato que já foi tratado)
  FOR v_bonus IN
    WITH RECURSIVE descendants(id, user_id) AS (
      SELECT id, user_id FROM partner_contracts WHERE id = v_contract_id
      UNION
      SELECT c.id, c.user_id
        FROM partner_contracts c
        JOIN descendants d ON c.referred_by_user_id = d.user_id
    )
    SELECT b.id, b.bonus_value, b.referrer_contract_id
    FROM partner_referral_bonuses b
    WHERE b.referred_contract_id IN (SELECT id FROM descendants WHERE id <> v_contract_id)
      AND b.status = 'AVAILABLE'
      AND b.paid_at IS NULL
  LOOP
    UPDATE partner_referral_bonuses SET status='CANCELLED' WHERE id = v_bonus.id;
    UPDATE partner_contracts
       SET available_balance = GREATEST(0, available_balance - v_bonus.bonus_value),
           updated_at = now()
     WHERE id = v_bonus.referrer_contract_id;
    UPDATE partner_payouts
       SET status = 'CANCELLED'
     WHERE referral_bonus_id = v_bonus.id
       AND status IN ('PAID','PENDING');
    v_reversed_count := v_reversed_count + 1;
    v_reversed_total := v_reversed_total + v_bonus.bonus_value;
  END LOOP;

  -- Atualiza o registro de saída
  UPDATE partner_network_exits
  SET reversed_available_count = reversed_available_count + v_reversed_count,
      reversed_available_total = reversed_available_total + v_reversed_total,
      cancelled_pending_count = cancelled_pending_count + v_cancelled_count,
      cancelled_pending_total = cancelled_pending_total + v_cancelled_total
  WHERE partner_contract_id = v_contract_id
    AND status = 'IN_TRANSIT';

  RAISE NOTICE 'Backfill Sabriny: reversed=% (R$ %), cancelled=% (R$ %)',
    v_reversed_count, v_reversed_total, v_cancelled_count, v_cancelled_total;
END $$;
