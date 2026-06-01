-- Fix: leave/transfer functions were cancelling bonuses received BY someone inside
-- the leaving subtree (e.g. Sabriny's bonus from her own downline Maria Marta).
-- Restrict cancellation to bonuses whose recipient is OUTSIDE the subtree
-- (i.e. only bonuses flowing UP to the old upline chain).

CREATE OR REPLACE FUNCTION public.partner_request_leave_sponsor(
  p_contract_id uuid,
  p_reason text DEFAULT NULL,
  p_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      AND b.referrer_contract_id NOT IN (SELECT id FROM descendants)
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
      AND b.referrer_contract_id NOT IN (SELECT id FROM descendants)
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
    'Parceiro solicitou saída da rede (apenas bônus que iriam para uplines antigas)'
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


CREATE OR REPLACE FUNCTION public.admin_transfer_partner_sponsor(
  p_contract_id uuid,
  p_new_sponsor_user_id uuid,
  p_cancel_pending_bonuses boolean DEFAULT true,
  p_reverse_available_bonuses boolean DEFAULT false,
  p_remove_from_binary boolean DEFAULT false,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  v_old_values := jsonb_build_object('referred_by_user_id', v_contract.referred_by_user_id);

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
        AND b.referrer_contract_id NOT IN (SELECT id FROM descendants)
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
        AND b.referrer_contract_id NOT IN (SELECT id FROM descendants)
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
    COALESCE(p_reason, 'Transferência de patrocinador (apenas bônus que iriam para uplines antigas)')
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


-- Restaurar o bônus de R$ 4.000 da Sabriny (referrer dentro da própria subárvore)
UPDATE public.partner_referral_bonuses
SET status = 'AVAILABLE'
WHERE id = '7385cfe2-5259-45f9-9e25-0eff315d4789'
  AND status = 'CANCELLED';

UPDATE public.partner_payouts
SET status = 'PAID'
WHERE id = '84e1d48d-82ed-498e-91e5-8546d71261f7'
  AND status = 'CANCELLED';

-- Recalcular available_balance da Sabriny = SUM(payouts PAID) - total_withdrawn
UPDATE public.partner_contracts pc
SET available_balance = GREATEST(0,
      COALESCE((
        SELECT SUM(amount) FROM public.partner_payouts
        WHERE partner_contract_id = pc.id AND status = 'PAID'
      ), 0) - COALESCE(pc.total_withdrawn, 0)
    ),
    total_received = COALESCE((
        SELECT SUM(amount) FROM public.partner_payouts
        WHERE partner_contract_id = pc.id AND status = 'PAID'
      ), 0),
    updated_at = now()
WHERE id = 'abd3ffff-d7fc-4f18-beb6-ac55986cefba';
