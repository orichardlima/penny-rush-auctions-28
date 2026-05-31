
-- =========================================================
-- AUTOATENDIMENTO: SAIR DA REDE DO PATROCINADOR
-- =========================================================

-- 1) Tabela de solicitações de saída
CREATE TABLE IF NOT EXISTS public.partner_network_exits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id uuid NOT NULL,
  partner_user_id uuid NOT NULL,
  old_sponsor_user_id uuid,
  old_sponsor_contract_id uuid,
  old_binary_parent_contract_id uuid,
  old_binary_position text,
  new_sponsor_user_id uuid,
  new_sponsor_contract_id uuid,
  status text NOT NULL DEFAULT 'IN_TRANSIT', -- IN_TRANSIT | COMPLETED | REVERTED_TIMEOUT | REVERTED_ADMIN
  cancelled_pending_count int NOT NULL DEFAULT 0,
  cancelled_pending_total numeric NOT NULL DEFAULT 0,
  reversed_available_count int NOT NULL DEFAULT 0,
  reversed_available_total numeric NOT NULL DEFAULT 0,
  reason text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pne_partner ON public.partner_network_exits(partner_contract_id);
CREATE INDEX IF NOT EXISTS idx_pne_old_sponsor ON public.partner_network_exits(old_sponsor_user_id);
CREATE INDEX IF NOT EXISTS idx_pne_status_expires ON public.partner_network_exits(status, expires_at);

GRANT SELECT, INSERT, UPDATE ON public.partner_network_exits TO authenticated;
GRANT ALL ON public.partner_network_exits TO service_role;

ALTER TABLE public.partner_network_exits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner views own exits"
  ON public.partner_network_exits FOR SELECT TO authenticated
  USING (partner_user_id = auth.uid());

CREATE POLICY "Old sponsor views exits about them"
  ON public.partner_network_exits FOR SELECT TO authenticated
  USING (old_sponsor_user_id = auth.uid());

CREATE POLICY "Admins manage all exits"
  ON public.partner_network_exits FOR ALL TO authenticated
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

-- =========================================================
-- 2) Helper: lista de contratos descendentes (downline binária recursiva)
-- =========================================================
CREATE OR REPLACE FUNCTION public.partner_get_binary_downline(p_contract_id uuid)
RETURNS TABLE(contract_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE downline AS (
    SELECT partner_contract_id, left_child_id, right_child_id
    FROM partner_binary_positions WHERE partner_contract_id = p_contract_id
    UNION ALL
    SELECT bp.partner_contract_id, bp.left_child_id, bp.right_child_id
    FROM partner_binary_positions bp
    JOIN downline d ON bp.partner_contract_id IN (d.left_child_id, d.right_child_id)
    WHERE bp.partner_contract_id IS NOT NULL
  )
  SELECT partner_contract_id FROM downline WHERE partner_contract_id <> p_contract_id;
$$;

GRANT EXECUTE ON FUNCTION public.partner_get_binary_downline(uuid) TO authenticated;

-- =========================================================
-- 3) Checar elegibilidade
-- =========================================================
CREATE OR REPLACE FUNCTION public.partner_check_leave_eligibility(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_days_since int;
  v_last_exit timestamptz;
  v_cooldown_until timestamptz;
  v_active_exit uuid;
BEGIN
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'contract_not_found');
  END IF;
  IF v_contract.user_id <> auth.uid() AND NOT is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_owner');
  END IF;
  IF v_contract.status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'contract_not_active');
  END IF;
  IF COALESCE(v_contract.financial_status,'paid') <> 'paid' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'contract_delinquent');
  END IF;
  IF v_contract.referred_by_user_id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_sponsor');
  END IF;

  v_days_since := EXTRACT(DAY FROM (now() - v_contract.created_at))::int;
  IF v_days_since < 30 THEN
    RETURN jsonb_build_object(
      'eligible', false, 'reason', 'grace_period',
      'days_since_activation', v_days_since,
      'days_until_eligible', 30 - v_days_since
    );
  END IF;

  SELECT id INTO v_active_exit FROM partner_network_exits
   WHERE partner_contract_id = p_contract_id AND status = 'IN_TRANSIT' LIMIT 1;
  IF v_active_exit IS NOT NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'exit_in_progress', 'exit_id', v_active_exit);
  END IF;

  SELECT MAX(created_at) INTO v_last_exit FROM partner_network_exits
   WHERE partner_contract_id = p_contract_id AND status IN ('COMPLETED','REVERTED_TIMEOUT');
  IF v_last_exit IS NOT NULL THEN
    v_cooldown_until := v_last_exit + interval '90 days';
    IF v_cooldown_until > now() THEN
      RETURN jsonb_build_object(
        'eligible', false, 'reason', 'cooldown',
        'cooldown_until', v_cooldown_until,
        'last_exit_at', v_last_exit
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'days_since_activation', v_days_since,
    'last_exit_at', v_last_exit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_check_leave_eligibility(uuid) TO authenticated;

-- =========================================================
-- 4) Prévia de impacto (espelho da prévia admin, mas qualquer dono pode ver a sua)
-- =========================================================
CREATE OR REPLACE FUNCTION public.partner_preview_leave_network(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_old_sponsor_name text;
  v_pending_count int := 0; v_pending_total numeric := 0;
  v_available_count int := 0; v_available_total numeric := 0;
  v_paid_count int := 0; v_paid_total numeric := 0;
  v_position RECORD;
  v_parent_name text;
BEGIN
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF v_contract.user_id <> auth.uid() AND NOT is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT full_name INTO v_old_sponsor_name FROM profiles WHERE user_id = v_contract.referred_by_user_id;

  IF v_contract.referred_by_user_id IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE status='PENDING'),
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
      AND referrer_contract_id IN (
        SELECT id FROM partner_contracts WHERE user_id = v_contract.referred_by_user_id
      );
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
    'old_sponsor_user_id', v_contract.referred_by_user_id,
    'old_sponsor_name', v_old_sponsor_name,
    'pending_count', v_pending_count, 'pending_total', v_pending_total,
    'available_count', v_available_count, 'available_total', v_available_total,
    'paid_count', v_paid_count, 'paid_total', v_paid_total,
    'binary_parent_contract_id', v_position.parent_contract_id,
    'binary_parent_name', v_position.parent_name,
    'binary_position', v_position.position
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_preview_leave_network(uuid) TO authenticated;

-- =========================================================
-- 5) Executar saída (self-service)
-- =========================================================
CREATE OR REPLACE FUNCTION public.partner_leave_sponsor_network(
  p_contract_id uuid,
  p_reason text DEFAULT NULL,
  p_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  -- cancela PENDING
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
  INTO v_cancelled_count, v_cancelled_total FROM cancelled;

  -- reverte AVAILABLE
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
    UPDATE partner_referral_bonuses SET status='CANCELLED' WHERE id = v_bonus.id;
    UPDATE partner_contracts
       SET available_balance = GREATEST(0, available_balance - v_bonus.bonus_value),
           updated_at = now()
     WHERE id = v_bonus.referrer_contract_id;
    v_reversed_count := v_reversed_count + 1;
    v_reversed_total := v_reversed_total + v_bonus.bonus_value;
  END LOOP;

  -- desconecta binário (guarda snapshot)
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

  -- contrato fica órfão (em trânsito)
  UPDATE partner_contracts
     SET referred_by_user_id = NULL, updated_at = now()
   WHERE id = p_contract_id;

  -- registra exit
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

  -- auditoria
  INSERT INTO admin_audit_log(
    admin_user_id, admin_name, action_type, target_type, target_id,
    old_values, new_values, description
  ) VALUES (
    v_contract.user_id,
    COALESCE((SELECT full_name FROM profiles WHERE user_id=v_contract.user_id), 'Parceiro'),
    'PARTNER_SELF_LEAVE_NETWORK', 'partner_contract', p_contract_id,
    jsonb_build_object('old_sponsor_user_id', v_old_sponsor_user_id),
    jsonb_build_object(
      'exit_id', v_exit_id,
      'cancelled_pending_count', v_cancelled_count,
      'cancelled_pending_total', v_cancelled_total,
      'reversed_available_count', v_reversed_count,
      'reversed_available_total', v_reversed_total,
      'ip', p_ip
    ),
    COALESCE(p_reason, 'Parceiro saiu da rede do patrocinador')
  );

  RETURN jsonb_build_object(
    'success', true,
    'exit_id', v_exit_id,
    'expires_at', (SELECT expires_at FROM partner_network_exits WHERE id = v_exit_id),
    'cancelled_pending_count', v_cancelled_count,
    'cancelled_pending_total', v_cancelled_total,
    'reversed_available_count', v_reversed_count,
    'reversed_available_total', v_reversed_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_leave_sponsor_network(uuid, text, text) TO authenticated;

-- =========================================================
-- 6) Buscar patrocinadores elegíveis (exclui downline e ex-patrocinador)
-- =========================================================
CREATE OR REPLACE FUNCTION public.partner_search_eligible_sponsors(
  p_contract_id uuid,
  p_term text
)
RETURNS TABLE(contract_id uuid, user_id uuid, full_name text, email text, plan_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_old_sponsor_user_id uuid;
BEGIN
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF v_contract.user_id <> auth.uid() AND NOT is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT old_sponsor_user_id INTO v_old_sponsor_user_id
  FROM partner_network_exits
  WHERE partner_contract_id = p_contract_id AND status = 'IN_TRANSIT'
  ORDER BY created_at DESC LIMIT 1;

  RETURN QUERY
  SELECT pc.id, pc.user_id, p.full_name, p.email, pc.plan_name
  FROM partner_contracts pc
  JOIN profiles p ON p.user_id = pc.user_id
  WHERE pc.status = 'ACTIVE'
    AND pc.user_id <> v_contract.user_id
    AND (v_old_sponsor_user_id IS NULL OR pc.user_id <> v_old_sponsor_user_id)
    AND pc.id NOT IN (SELECT contract_id FROM partner_get_binary_downline(p_contract_id))
    AND (
      p.full_name ILIKE '%'||p_term||'%' OR
      p.email     ILIKE '%'||p_term||'%'
    )
  ORDER BY p.full_name
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_search_eligible_sponsors(uuid, text) TO authenticated;

-- =========================================================
-- 7) Escolher novo patrocinador (efetiva o exit)
-- =========================================================
CREATE OR REPLACE FUNCTION public.partner_choose_new_sponsor(
  p_contract_id uuid,
  p_new_sponsor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_exit RECORD;
  v_new_sponsor_contract_id uuid;
  v_position_result jsonb;
BEGIN
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF v_contract.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_exit FROM partner_network_exits
   WHERE partner_contract_id = p_contract_id AND status='IN_TRANSIT'
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhuma saída em trânsito para este contrato'; END IF;

  IF p_new_sponsor_user_id = v_contract.user_id THEN
    RAISE EXCEPTION 'Você não pode ser seu próprio patrocinador';
  END IF;
  IF p_new_sponsor_user_id = v_exit.old_sponsor_user_id THEN
    RAISE EXCEPTION 'Não é permitido voltar para o patrocinador anterior por esta via';
  END IF;

  SELECT id INTO v_new_sponsor_contract_id
  FROM partner_contracts
  WHERE user_id = p_new_sponsor_user_id AND status='ACTIVE'
  ORDER BY created_at ASC LIMIT 1;
  IF v_new_sponsor_contract_id IS NULL THEN
    RAISE EXCEPTION 'Novo patrocinador não possui contrato ATIVO';
  END IF;

  -- valida downline
  IF v_new_sponsor_contract_id IN (SELECT contract_id FROM partner_get_binary_downline(p_contract_id)) THEN
    RAISE EXCEPTION 'Novo patrocinador não pode estar na sua própria downline';
  END IF;

  -- atualiza contrato
  UPDATE partner_contracts
     SET referred_by_user_id = p_new_sponsor_user_id, updated_at = now()
   WHERE id = p_contract_id;

  -- reposiciona binário: tenta perna esquerda do novo sponsor
  BEGIN
    v_position_result := position_partner_binary(p_contract_id, v_new_sponsor_contract_id, 'left');
    IF NOT (v_position_result->>'success')::boolean THEN
      v_position_result := position_partner_binary(p_contract_id, v_new_sponsor_contract_id, 'right');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- mantém órfão na árvore caso autoposicionamento falhe; admin pode posicionar depois
    v_position_result := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  UPDATE partner_network_exits
     SET status='COMPLETED',
         new_sponsor_user_id = p_new_sponsor_user_id,
         new_sponsor_contract_id = v_new_sponsor_contract_id,
         resolved_at = now()
   WHERE id = v_exit.id;

  INSERT INTO admin_audit_log(
    admin_user_id, admin_name, action_type, target_type, target_id,
    old_values, new_values, description
  ) VALUES (
    v_contract.user_id,
    COALESCE((SELECT full_name FROM profiles WHERE user_id=v_contract.user_id),'Parceiro'),
    'PARTNER_CHOOSE_NEW_SPONSOR', 'partner_contract', p_contract_id,
    jsonb_build_object('exit_id', v_exit.id, 'old_sponsor_user_id', v_exit.old_sponsor_user_id),
    jsonb_build_object('new_sponsor_user_id', p_new_sponsor_user_id, 'position_result', v_position_result),
    'Parceiro escolheu novo patrocinador após saída'
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_sponsor_user_id', p_new_sponsor_user_id,
    'position_result', v_position_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_choose_new_sponsor(uuid, uuid) TO authenticated;

-- =========================================================
-- 8) Expiração automática: 7 dias sem escolha -> volta ao antigo
-- =========================================================
CREATE OR REPLACE FUNCTION public.partner_process_expired_network_exits()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_exit RECORD;
  v_old_sponsor_contract_id uuid;
  v_processed int := 0;
  v_position_result jsonb;
BEGIN
  FOR v_exit IN
    SELECT * FROM partner_network_exits
    WHERE status='IN_TRANSIT' AND expires_at < now()
  LOOP
    -- restaura sponsor
    UPDATE partner_contracts
       SET referred_by_user_id = v_exit.old_sponsor_user_id, updated_at = now()
     WHERE id = v_exit.partner_contract_id;

    -- tenta reposicionar binário no antigo parent (se ainda houver vaga)
    IF v_exit.old_binary_parent_contract_id IS NOT NULL THEN
      BEGIN
        v_position_result := position_partner_binary(
          v_exit.partner_contract_id,
          v_exit.old_binary_parent_contract_id,
          COALESCE(v_exit.old_binary_position, 'left')
        );
        IF NOT (v_position_result->>'success')::boolean THEN
          -- tenta outra perna
          v_position_result := position_partner_binary(
            v_exit.partner_contract_id,
            v_exit.old_binary_parent_contract_id,
            CASE WHEN v_exit.old_binary_position='right' THEN 'left' ELSE 'right' END
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_position_result := jsonb_build_object('success', false, 'error', SQLERRM);
      END;
    END IF;

    UPDATE partner_network_exits
       SET status='REVERTED_TIMEOUT', resolved_at = now()
     WHERE id = v_exit.id;

    INSERT INTO admin_audit_log(
      admin_user_id, admin_name, action_type, target_type, target_id,
      old_values, new_values, description
    ) VALUES (
      v_exit.partner_user_id, 'Sistema (timeout)', 'PARTNER_EXIT_REVERTED_TIMEOUT',
      'partner_contract', v_exit.partner_contract_id,
      jsonb_build_object('exit_id', v_exit.id),
      jsonb_build_object('restored_sponsor_user_id', v_exit.old_sponsor_user_id, 'position_result', v_position_result),
      'Saída revertida automaticamente após 7 dias sem escolha de novo patrocinador'
    );

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'ran_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_process_expired_network_exits() TO service_role;

-- =========================================================
-- 9) Agendar cron diário (06:00 UTC = 03:00 BRT)
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('partner_network_exit_expiry')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='partner_network_exit_expiry');
    PERFORM cron.schedule(
      'partner_network_exit_expiry',
      '0 * * * *', -- hora em hora
      $cron$ SELECT public.partner_process_expired_network_exits(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
