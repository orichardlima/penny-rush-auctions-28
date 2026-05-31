
-- ============ 1. Tabela notifications ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  type        text NOT NULL,
  title       text NOT NULL,
  message     text,
  link        text,
  metadata    jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

-- ============ 2. reminders_sent em partner_network_exits ============
ALTER TABLE public.partner_network_exits
  ADD COLUMN IF NOT EXISTS reminders_sent jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============ 3. Helper notify_user ============
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id   uuid,
  p_type      text,
  p_title     text,
  p_message   text DEFAULT NULL,
  p_link      text DEFAULT NULL,
  p_metadata  jsonb DEFAULT NULL,
  p_email_type text DEFAULT NULL,
  p_email_data jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_id uuid;
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.notifications(user_id, type, title, message, link, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, p_metadata)
  RETURNING id INTO v_notif_id;

  IF p_email_type IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
    IF v_email IS NOT NULL AND v_email <> '' THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/send-email',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb,
          body := jsonb_build_object('type', p_email_type, 'to', v_email, 'data', COALESCE(p_email_data, '{}'::jsonb))
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'notify_user: pg_net send-email failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN v_notif_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text, jsonb, text, jsonb) TO authenticated, service_role;

-- ============ 4. partner_leave_sponsor_network (com notificações) ============
CREATE OR REPLACE FUNCTION public.partner_leave_sponsor_network(
  p_contract_id uuid, p_reason text DEFAULT NULL, p_ip text DEFAULT NULL
) RETURNS jsonb
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
  v_expires_at timestamptz;
  v_partner_name text;
  v_old_sponsor_name text;
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
  ) RETURNING id, expires_at INTO v_exit_id, v_expires_at;

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

  -- ====== Notificações ======
  SELECT full_name INTO v_partner_name FROM profiles WHERE user_id = v_contract.user_id;
  v_partner_name := COALESCE(v_partner_name, 'Parceiro');
  IF v_old_sponsor_user_id IS NOT NULL THEN
    SELECT full_name INTO v_old_sponsor_name FROM profiles WHERE user_id = v_old_sponsor_user_id;
  END IF;

  -- Parceiro
  PERFORM notify_user(
    v_contract.user_id,
    'network_exit_partner',
    'Saída da rede confirmada',
    'Você tem 7 dias (até ' || to_char(v_expires_at AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY') || ') para escolher um novo patrocinador.',
    '/minha-parceria',
    jsonb_build_object('exit_id', v_exit_id, 'expires_at', v_expires_at),
    'network_exit_partner',
    jsonb_build_object(
      'partnerName', v_partner_name,
      'oldSponsorName', v_old_sponsor_name,
      'expiresAt', v_expires_at,
      'cancelledPendingTotal', v_cancelled_total,
      'reversedAvailableTotal', v_reversed_total,
      'reason', p_reason
    )
  );

  -- Patrocinador antigo
  IF v_old_sponsor_user_id IS NOT NULL THEN
    PERFORM notify_user(
      v_old_sponsor_user_id,
      'network_exit_old_sponsor',
      v_partner_name || ' saiu da sua rede',
      'O parceiro está em período de trânsito de 7 dias. Pode voltar automaticamente se não escolher novo patrocinador.',
      '/minha-parceria',
      jsonb_build_object('exit_id', v_exit_id, 'partner_user_id', v_contract.user_id),
      'network_exit_old_sponsor',
      jsonb_build_object(
        'sponsorName', COALESCE(v_old_sponsor_name, 'Parceiro'),
        'partnerName', v_partner_name,
        'reason', p_reason,
        'cancelledPendingTotal', v_cancelled_total,
        'reversedAvailableTotal', v_reversed_total,
        'definitive', false
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'exit_id', v_exit_id,
    'expires_at', v_expires_at,
    'cancelled_pending_count', v_cancelled_count,
    'cancelled_pending_total', v_cancelled_total,
    'reversed_available_count', v_reversed_count,
    'reversed_available_total', v_reversed_total
  );
END;
$function$;

-- ============ 5. partner_choose_new_sponsor (com notificações) ============
CREATE OR REPLACE FUNCTION public.partner_choose_new_sponsor(
  p_contract_id uuid, p_new_sponsor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_contract RECORD;
  v_exit RECORD;
  v_new_sponsor_contract_id uuid;
  v_position_result jsonb;
  v_partner_name text;
  v_new_sponsor_name text;
  v_old_sponsor_name text;
BEGIN
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF v_contract.user_id <> auth.uid() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

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

  IF v_new_sponsor_contract_id IN (SELECT contract_id FROM partner_get_binary_downline(p_contract_id)) THEN
    RAISE EXCEPTION 'Novo patrocinador não pode estar na sua própria downline';
  END IF;

  UPDATE partner_contracts
     SET referred_by_user_id = p_new_sponsor_user_id, updated_at = now()
   WHERE id = p_contract_id;

  BEGIN
    v_position_result := position_partner_binary(p_contract_id, v_new_sponsor_contract_id, 'left');
    IF NOT (v_position_result->>'success')::boolean THEN
      v_position_result := position_partner_binary(p_contract_id, v_new_sponsor_contract_id, 'right');
    END IF;
  EXCEPTION WHEN OTHERS THEN
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

  -- ====== Notificações ======
  SELECT full_name INTO v_partner_name FROM profiles WHERE user_id = v_contract.user_id;
  v_partner_name := COALESCE(v_partner_name, 'Parceiro');
  SELECT full_name INTO v_new_sponsor_name FROM profiles WHERE user_id = p_new_sponsor_user_id;
  v_new_sponsor_name := COALESCE(v_new_sponsor_name, 'Patrocinador');
  IF v_exit.old_sponsor_user_id IS NOT NULL THEN
    SELECT full_name INTO v_old_sponsor_name FROM profiles WHERE user_id = v_exit.old_sponsor_user_id;
  END IF;

  -- Parceiro
  PERFORM notify_user(
    v_contract.user_id,
    'network_exit_new_sponsor_partner',
    'Novo patrocinador confirmado',
    'Você agora faz parte da rede de ' || v_new_sponsor_name || '.',
    '/minha-parceria',
    jsonb_build_object('exit_id', v_exit.id, 'new_sponsor_user_id', p_new_sponsor_user_id),
    'network_exit_new_sponsor',
    jsonb_build_object('recipientName', v_partner_name, 'partnerName', v_partner_name, 'newSponsorName', v_new_sponsor_name, 'forPartner', true)
  );

  -- Novo patrocinador
  PERFORM notify_user(
    p_new_sponsor_user_id,
    'network_exit_new_sponsor_sponsor',
    v_partner_name || ' entrou na sua rede',
    'Boas-vindas ao novo membro. Seus próximos bônus de indicação serão direcionados a você.',
    '/minha-parceria',
    jsonb_build_object('exit_id', v_exit.id, 'partner_user_id', v_contract.user_id),
    'network_exit_new_sponsor',
    jsonb_build_object('recipientName', v_new_sponsor_name, 'partnerName', v_partner_name, 'newSponsorName', v_new_sponsor_name, 'forPartner', false)
  );

  -- Patrocinador antigo (saída agora definitiva)
  IF v_exit.old_sponsor_user_id IS NOT NULL THEN
    PERFORM notify_user(
      v_exit.old_sponsor_user_id,
      'network_exit_definitive',
      v_partner_name || ' encontrou um novo patrocinador',
      'A saída deste parceiro da sua rede agora é definitiva.',
      '/minha-parceria',
      jsonb_build_object('exit_id', v_exit.id, 'partner_user_id', v_contract.user_id),
      'network_exit_old_sponsor',
      jsonb_build_object(
        'sponsorName', COALESCE(v_old_sponsor_name, 'Parceiro'),
        'partnerName', v_partner_name,
        'definitive', true
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_sponsor_user_id', p_new_sponsor_user_id,
    'position_result', v_position_result
  );
END;
$function$;

-- ============ 6. partner_process_expired_network_exits (com notificações) ============
CREATE OR REPLACE FUNCTION public.partner_process_expired_network_exits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_exit RECORD;
  v_processed int := 0;
  v_position_result jsonb;
  v_partner_name text;
  v_old_sponsor_name text;
BEGIN
  FOR v_exit IN
    SELECT * FROM partner_network_exits
    WHERE status='IN_TRANSIT' AND expires_at < now()
  LOOP
    UPDATE partner_contracts
       SET referred_by_user_id = v_exit.old_sponsor_user_id, updated_at = now()
     WHERE id = v_exit.partner_contract_id;

    IF v_exit.old_binary_parent_contract_id IS NOT NULL THEN
      BEGIN
        v_position_result := position_partner_binary(
          v_exit.partner_contract_id,
          v_exit.old_binary_parent_contract_id,
          COALESCE(v_exit.old_binary_position, 'left')
        );
        IF NOT (v_position_result->>'success')::boolean THEN
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

    -- ====== Notificações ======
    SELECT full_name INTO v_partner_name FROM profiles WHERE user_id = v_exit.partner_user_id;
    v_partner_name := COALESCE(v_partner_name, 'Parceiro');
    IF v_exit.old_sponsor_user_id IS NOT NULL THEN
      SELECT full_name INTO v_old_sponsor_name FROM profiles WHERE user_id = v_exit.old_sponsor_user_id;
    END IF;

    PERFORM notify_user(
      v_exit.partner_user_id,
      'network_exit_reverted',
      'Você voltou para a rede anterior',
      'O prazo de 7 dias expirou. Sua conta foi reconectada automaticamente à rede de ' || COALESCE(v_old_sponsor_name, 'seu patrocinador anterior') || '.',
      '/minha-parceria',
      jsonb_build_object('exit_id', v_exit.id),
      'network_exit_reverted',
      jsonb_build_object('recipientName', v_partner_name, 'partnerName', v_partner_name, 'oldSponsorName', v_old_sponsor_name, 'forPartner', true)
    );

    IF v_exit.old_sponsor_user_id IS NOT NULL THEN
      PERFORM notify_user(
        v_exit.old_sponsor_user_id,
        'network_exit_reverted_sponsor',
        v_partner_name || ' voltou para a sua rede',
        'O parceiro não escolheu um novo patrocinador no prazo e foi reconectado à sua rede.',
        '/minha-parceria',
        jsonb_build_object('exit_id', v_exit.id, 'partner_user_id', v_exit.partner_user_id),
        'network_exit_reverted',
        jsonb_build_object('recipientName', COALESCE(v_old_sponsor_name, 'Parceiro'), 'partnerName', v_partner_name, 'oldSponsorName', v_old_sponsor_name, 'forPartner', false)
      );
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'ran_at', now());
END;
$function$;

-- ============ 7. Lembretes dia 5 e 6 ============
CREATE OR REPLACE FUNCTION public.partner_send_network_exit_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_exit RECORD;
  v_days_left int;
  v_marker text;
  v_partner_name text;
  v_sent int := 0;
BEGIN
  FOR v_exit IN
    SELECT * FROM partner_network_exits
    WHERE status='IN_TRANSIT'
      AND expires_at > now()
      AND expires_at <= now() + interval '2 days'
  LOOP
    v_days_left := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_exit.expires_at - now())) / 86400.0)::int);
    v_marker := 'day_' || v_days_left::text;

    IF (v_exit.reminders_sent ? v_marker) THEN
      CONTINUE;
    END IF;

    SELECT full_name INTO v_partner_name FROM profiles WHERE user_id = v_exit.partner_user_id;
    v_partner_name := COALESCE(v_partner_name, 'Parceiro');

    PERFORM notify_user(
      v_exit.partner_user_id,
      'network_exit_reminder',
      'Faltam ' || v_days_left || ' dia(s) para escolher novo patrocinador',
      'Se você não escolher até ' || to_char(v_exit.expires_at AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY') || ', voltará automaticamente para a rede anterior.',
      '/minha-parceria',
      jsonb_build_object('exit_id', v_exit.id, 'days_left', v_days_left),
      'network_exit_reminder',
      jsonb_build_object('partnerName', v_partner_name, 'daysLeft', v_days_left, 'expiresAt', v_exit.expires_at)
    );

    UPDATE partner_network_exits
       SET reminders_sent = reminders_sent || to_jsonb(v_marker)
     WHERE id = v_exit.id;

    v_sent := v_sent + 1;
  END LOOP;

  RETURN jsonb_build_object('sent', v_sent, 'ran_at', now());
END;
$function$;

-- Cron diário 10:00 (BRT = 13:00 UTC) — roda 1x/dia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='partner-network-exit-reminders') THEN
    PERFORM cron.unschedule('partner-network-exit-reminders');
  END IF;
  PERFORM cron.schedule(
    'partner-network-exit-reminders',
    '0 13 * * *',
    $cron$ SELECT public.partner_send_network_exit_reminders(); $cron$
  );
END $$;
