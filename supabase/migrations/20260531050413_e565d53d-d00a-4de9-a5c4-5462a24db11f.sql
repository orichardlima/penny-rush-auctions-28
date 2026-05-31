
-- Função admin para transferir patrocinador de um parceiro (rede de Géssica/Sabriny e casos futuros)
CREATE OR REPLACE FUNCTION public.admin_transfer_partner_sponsor(
  p_contract_id uuid,
  p_new_sponsor_user_id uuid DEFAULT NULL, -- NULL = empresa (órfão)
  p_cancel_pending_bonuses boolean DEFAULT true,
  p_reverse_available_bonuses boolean DEFAULT true,
  p_remove_from_binary boolean DEFAULT true,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_name text;
  v_contract RECORD;
  v_new_sponsor_contract_id uuid;
  v_old_sponsor_user_id uuid;
  v_old_position RECORD;
  v_cancelled_pending_count int := 0;
  v_cancelled_pending_total numeric := 0;
  v_reversed_available_count int := 0;
  v_reversed_available_total numeric := 0;
  v_bonus RECORD;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  -- valida admin
  IF NOT is_admin_user(v_admin_id) THEN
    RAISE EXCEPTION 'Acesso negado: requer privilégios de admin';
  END IF;

  SELECT COALESCE(full_name, email, 'Admin') INTO v_admin_name
  FROM profiles WHERE user_id = v_admin_id;

  -- pega contrato alvo
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato % não encontrado', p_contract_id;
  END IF;

  v_old_sponsor_user_id := v_contract.referred_by_user_id;

  -- resolve novo sponsor contract id (se houver)
  IF p_new_sponsor_user_id IS NOT NULL THEN
    SELECT id INTO v_new_sponsor_contract_id
    FROM partner_contracts
    WHERE user_id = p_new_sponsor_user_id AND status = 'ACTIVE'
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_new_sponsor_contract_id IS NULL THEN
      RAISE EXCEPTION 'Novo patrocinador não possui contrato ATIVO';
    END IF;
    IF p_new_sponsor_user_id = v_contract.user_id THEN
      RAISE EXCEPTION 'Parceiro não pode ser seu próprio patrocinador';
    END IF;
  END IF;

  -- snapshot ANTES
  v_old_values := jsonb_build_object(
    'referred_by_user_id', v_contract.referred_by_user_id,
    'available_balance_old_sponsor', (
      SELECT available_balance FROM partner_contracts
      WHERE user_id = v_old_sponsor_user_id LIMIT 1
    )
  );

  -- 1) cancela bônus PENDING
  IF p_cancel_pending_bonuses AND v_old_sponsor_user_id IS NOT NULL THEN
    WITH cancelled AS (
      UPDATE partner_referral_bonuses b
      SET status = 'CANCELLED'
      WHERE b.referred_contract_id = p_contract_id
        AND b.status = 'PENDING'
        AND b.referrer_contract_id IN (
          SELECT id FROM partner_contracts WHERE user_id = v_old_sponsor_user_id
        )
      RETURNING bonus_value
    )
    SELECT COUNT(*), COALESCE(SUM(bonus_value),0)
    INTO v_cancelled_pending_count, v_cancelled_pending_total FROM cancelled;
  END IF;

  -- 2) reverte bônus AVAILABLE não pagos (debita do saldo do antigo patrocinador)
  IF p_reverse_available_bonuses AND v_old_sponsor_user_id IS NOT NULL THEN
    FOR v_bonus IN
      SELECT b.id, b.bonus_value, b.referrer_contract_id
      FROM partner_referral_bonuses b
      WHERE b.referred_contract_id = p_contract_id
        AND b.status = 'AVAILABLE'
        AND b.paid_at IS NULL
        AND b.referrer_contract_id IN (
          SELECT id FROM partner_contracts WHERE user_id = v_old_sponsor_user_id
        )
    LOOP
      UPDATE partner_referral_bonuses
      SET status = 'CANCELLED'
      WHERE id = v_bonus.id;

      UPDATE partner_contracts
      SET available_balance = GREATEST(0, available_balance - v_bonus.bonus_value),
          updated_at = now()
      WHERE id = v_bonus.referrer_contract_id;

      v_reversed_available_count := v_reversed_available_count + 1;
      v_reversed_available_total := v_reversed_available_total + v_bonus.bonus_value;
    END LOOP;
  END IF;

  -- 3) remove da árvore binária (apenas desconecta; pontos do upline devem ser recalculados pelo admin)
  IF p_remove_from_binary THEN
    SELECT * INTO v_old_position FROM partner_binary_positions
    WHERE partner_contract_id = p_contract_id;

    IF FOUND AND v_old_position.parent_contract_id IS NOT NULL THEN
      -- limpa ponteiro do parent
      UPDATE partner_binary_positions
      SET left_child_id = CASE WHEN left_child_id = p_contract_id THEN NULL ELSE left_child_id END,
          right_child_id = CASE WHEN right_child_id = p_contract_id THEN NULL ELSE right_child_id END,
          updated_at = now()
      WHERE partner_contract_id = v_old_position.parent_contract_id;

      -- desconecta o próprio
      UPDATE partner_binary_positions
      SET parent_contract_id = NULL,
          sponsor_contract_id = NULL,
          position = NULL,
          updated_at = now()
      WHERE partner_contract_id = p_contract_id;
    END IF;
  END IF;

  -- 4) atualiza patrocinador no contrato
  UPDATE partner_contracts
  SET referred_by_user_id = p_new_sponsor_user_id,
      updated_at = now()
  WHERE id = p_contract_id;

  -- 5) limpa intents antigas (para que ao reativar não puxe Géssica de volta)
  IF v_old_sponsor_user_id IS NOT NULL THEN
    DELETE FROM partner_intents
    WHERE user_id = v_contract.user_id
      AND referred_by_user_id = v_old_sponsor_user_id
      AND status IN ('pending','expired');
  END IF;

  -- 6) limpa affiliate_referrals
  UPDATE affiliate_referrals
  SET converted = false
  WHERE referred_user_id = v_contract.user_id
    AND affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = v_old_sponsor_user_id
    );

  v_new_values := jsonb_build_object(
    'referred_by_user_id', p_new_sponsor_user_id,
    'cancelled_pending_count', v_cancelled_pending_count,
    'cancelled_pending_total', v_cancelled_pending_total,
    'reversed_available_count', v_reversed_available_count,
    'reversed_available_total', v_reversed_available_total,
    'removed_from_binary', p_remove_from_binary,
    'reason', p_reason
  );

  -- 7) auditoria
  INSERT INTO admin_audit_log(
    admin_user_id, admin_name, action_type, target_type, target_id,
    old_values, new_values, description
  ) VALUES (
    v_admin_id, v_admin_name, 'TRANSFER_SPONSOR', 'partner_contract', p_contract_id,
    v_old_values, v_new_values,
    COALESCE(p_reason, 'Transferência de patrocinador')
  );

  RETURN jsonb_build_object(
    'success', true,
    'contract_id', p_contract_id,
    'old_sponsor_user_id', v_old_sponsor_user_id,
    'new_sponsor_user_id', p_new_sponsor_user_id,
    'cancelled_pending_count', v_cancelled_pending_count,
    'cancelled_pending_total', v_cancelled_pending_total,
    'reversed_available_count', v_reversed_available_count,
    'reversed_available_total', v_reversed_available_total,
    'removed_from_binary', p_remove_from_binary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_transfer_partner_sponsor(uuid, uuid, boolean, boolean, boolean, text) TO authenticated;

-- RPC auxiliar: prévia (read-only) do impacto antes de confirmar
CREATE OR REPLACE FUNCTION public.admin_preview_partner_sponsor_transfer(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_old_sponsor_user_id uuid;
  v_old_sponsor_name text;
  v_pending_count int := 0;
  v_pending_total numeric := 0;
  v_available_count int := 0;
  v_available_total numeric := 0;
  v_paid_count int := 0;
  v_paid_total numeric := 0;
  v_position RECORD;
  v_parent_name text;
  v_partner_name text;
BEGIN
  IF NOT is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT pc.*, p.full_name AS partner_name
  INTO v_contract
  FROM partner_contracts pc
  LEFT JOIN profiles p ON p.user_id = pc.user_id
  WHERE pc.id = p_contract_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

  v_old_sponsor_user_id := v_contract.referred_by_user_id;
  SELECT full_name INTO v_old_sponsor_name FROM profiles WHERE user_id = v_old_sponsor_user_id;
  v_partner_name := v_contract.partner_name;

  IF v_old_sponsor_user_id IS NOT NULL THEN
    SELECT COUNT(*) FILTER (WHERE status='PENDING'),
           COALESCE(SUM(bonus_value) FILTER (WHERE status='PENDING'),0),
           COUNT(*) FILTER (WHERE status='AVAILABLE' AND paid_at IS NULL),
           COALESCE(SUM(bonus_value) FILTER (WHERE status='AVAILABLE' AND paid_at IS NULL),0),
           COUNT(*) FILTER (WHERE status='PAID' OR paid_at IS NOT NULL),
           COALESCE(SUM(bonus_value) FILTER (WHERE status='PAID' OR paid_at IS NOT NULL),0)
    INTO v_pending_count, v_pending_total,
         v_available_count, v_available_total,
         v_paid_count, v_paid_total
    FROM partner_referral_bonuses
    WHERE referred_contract_id = p_contract_id
      AND referrer_contract_id IN (SELECT id FROM partner_contracts WHERE user_id = v_old_sponsor_user_id);
  END IF;

  SELECT bp.*, pp.full_name AS parent_name
  INTO v_position
  FROM partner_binary_positions bp
  LEFT JOIN partner_contracts pc ON pc.id = bp.parent_contract_id
  LEFT JOIN profiles pp ON pp.user_id = pc.user_id
  WHERE bp.partner_contract_id = p_contract_id;

  RETURN jsonb_build_object(
    'contract_id', p_contract_id,
    'partner_user_id', v_contract.user_id,
    'partner_name', v_partner_name,
    'old_sponsor_user_id', v_old_sponsor_user_id,
    'old_sponsor_name', v_old_sponsor_name,
    'pending_count', v_pending_count,
    'pending_total', v_pending_total,
    'available_count', v_available_count,
    'available_total', v_available_total,
    'paid_count', v_paid_count,
    'paid_total', v_paid_total,
    'binary_parent_contract_id', COALESCE(v_position.parent_contract_id, NULL),
    'binary_parent_name', v_position.parent_name,
    'binary_position', v_position.position
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_preview_partner_sponsor_transfer(uuid) TO authenticated;
