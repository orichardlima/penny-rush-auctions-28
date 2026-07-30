
-- ============================================================
-- 1) Versão explícita do fluxo
-- ============================================================
ALTER TABLE public.partner_withdrawals
  ADD COLUMN IF NOT EXISTS withdrawal_flow_version text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS uses_allocations boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.partner_withdrawals
    ADD CONSTRAINT partner_withdrawals_flow_version_chk
    CHECK (withdrawal_flow_version IN ('legacy','v2'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.partner_withdrawals
    ADD CONSTRAINT partner_withdrawals_flow_alloc_chk
    CHECK (uses_allocations = (withdrawal_flow_version = 'v2'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- todo o histórico existente é legacy
UPDATE public.partner_withdrawals
   SET withdrawal_flow_version = 'legacy', uses_allocations = false
 WHERE withdrawal_flow_version IS DISTINCT FROM 'v2';

CREATE INDEX IF NOT EXISTS idx_partner_withdrawals_flow
  ON public.partner_withdrawals (withdrawal_flow_version, status);

-- ============================================================
-- 2) Inconsistências de composição (alerta administrativo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_integrity_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.partner_withdrawals(id) ON DELETE CASCADE,
  issue text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_integrity_withdrawal
  ON public.withdrawal_integrity_issues (withdrawal_id);
GRANT SELECT ON public.withdrawal_integrity_issues TO authenticated;
GRANT ALL ON public.withdrawal_integrity_issues TO service_role;
ALTER TABLE public.withdrawal_integrity_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "withdrawal_integrity_admin_only" ON public.withdrawal_integrity_issues;
CREATE POLICY "withdrawal_integrity_admin_only" ON public.withdrawal_integrity_issues
FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- ============================================================
-- 3) Validação de integridade da composição v2
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_withdrawal_composition(_withdrawal_id uuid, _raise boolean DEFAULT true)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  w RECORD; v_sum numeric; v_bad int; v_issue text; v_details jsonb;
BEGIN
  SELECT * INTO w FROM public.partner_withdrawals WHERE id = _withdrawal_id;
  IF w IS NULL OR w.withdrawal_flow_version <> 'v2' THEN RETURN true; END IF;

  SELECT COALESCE(SUM(reserved_amount),0), COUNT(*)
    INTO v_sum, v_bad
    FROM public.withdrawal_allocations WHERE withdrawal_id = _withdrawal_id;

  IF v_bad = 0 THEN
    v_issue := 'v2_sem_composicao';
    v_details := jsonb_build_object('requested_amount', w.amount);
  ELSIF ROUND(v_sum,2) <> ROUND(w.amount,2) THEN
    v_issue := 'soma_divergente';
    v_details := jsonb_build_object('requested_amount', w.amount, 'sum_allocations', v_sum);
  ELSE
    SELECT COUNT(*) INTO v_bad FROM public.withdrawal_allocations
     WHERE withdrawal_id = _withdrawal_id
       AND ( (balance_type='partnership_repass' AND contract_id IS NULL)
          OR (balance_type='network_bonus' AND wallet_user_id IS NULL)
          OR (contract_id IS NOT NULL AND wallet_user_id IS NOT NULL) );
    IF v_bad > 0 THEN
      v_issue := 'allocation_com_origem_invalida';
      v_details := jsonb_build_object('linhas_invalidas', v_bad);
    END IF;
  END IF;

  IF v_issue IS NULL THEN
    DELETE FROM public.withdrawal_integrity_issues WHERE withdrawal_id = _withdrawal_id;
    RETURN true;
  END IF;

  INSERT INTO public.withdrawal_integrity_issues (withdrawal_id, issue, details)
  VALUES (_withdrawal_id, v_issue, v_details);

  IF _raise THEN
    RAISE EXCEPTION 'Integridade da composição do saque % violada: % (%)', _withdrawal_id, v_issue, v_details;
  END IF;
  RETURN false;
END;
$$;

-- ============================================================
-- 4) Cálculo contratual: v2 só por allocations de repasse
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_partner_contract_totals(_contract_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_credited numeric; v_withdrawn numeric; v_reserved numeric; v_avail numeric;
BEGIN
  IF _contract_id IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.allow_total_sync', 'on', true);

  SELECT COALESCE(SUM(amount),0) INTO v_credited
    FROM public.partner_payouts
   WHERE partner_contract_id = _contract_id AND status = 'PAID'
     AND COALESCE(payout_type,'partnership_weekly_repass') = 'partnership_weekly_repass';

  -- V2: exclusivamente allocations de repasse, pelo contract_id da própria allocation
  SELECT COALESCE(SUM(a.confirmed_amount),0) INTO v_withdrawn
    FROM public.withdrawal_allocations a
    JOIN public.partner_withdrawals w ON w.id = a.withdrawal_id
   WHERE a.contract_id = _contract_id
     AND a.balance_type = 'partnership_repass'
     AND a.status = 'CONFIRMED'
     AND w.withdrawal_flow_version = 'v2';

  SELECT COALESCE(SUM(a.reserved_amount),0) INTO v_reserved
    FROM public.withdrawal_allocations a
    JOIN public.partner_withdrawals w ON w.id = a.withdrawal_id
   WHERE a.contract_id = _contract_id
     AND a.balance_type = 'partnership_repass'
     AND a.status = 'RESERVED'
     AND w.withdrawal_flow_version = 'v2';

  -- LEGACY: apenas solicitações realmente anteriores ao novo fluxo
  v_withdrawn := v_withdrawn + COALESCE((
    SELECT SUM(w.amount) FROM public.partner_withdrawals w
     WHERE w.partner_contract_id = _contract_id AND w.status = 'PAID'
       AND w.withdrawal_flow_version = 'legacy'),0);

  v_reserved := v_reserved + COALESCE((
    SELECT SUM(w.amount) FROM public.partner_withdrawals w
     WHERE w.partner_contract_id = _contract_id
       AND w.status IN ('PENDING','APPROVED','PROCESSING')
       AND w.withdrawal_flow_version = 'legacy'),0);

  v_avail := ROUND(v_credited - v_withdrawn - v_reserved, 2);

  IF v_avail < -0.005 THEN
    INSERT INTO public.contract_balance_anomalies (contract_id, credited, withdrawn, reserved, deficit)
    VALUES (_contract_id, v_credited, v_withdrawn, v_reserved, -v_avail)
    ON CONFLICT (contract_id) DO UPDATE
      SET credited = EXCLUDED.credited, withdrawn = EXCLUDED.withdrawn,
          reserved = EXCLUDED.reserved, deficit = EXCLUDED.deficit, detected_at = now();
  ELSE
    DELETE FROM public.contract_balance_anomalies WHERE contract_id = _contract_id;
  END IF;

  UPDATE public.partner_contracts
     SET total_received = v_credited,
         total_withdrawn = v_withdrawn,
         reserved_balance = v_reserved,
         updated_at = now()
   WHERE id = _contract_id;

  PERFORM set_config('app.allow_total_sync', 'off', true);
END;
$$;

-- ============================================================
-- 5) Rotina de solicitação marca v2 e valida a composição
-- ============================================================
CREATE OR REPLACE FUNCTION public.partner_request_withdrawal(
  _amount numeric,
  _source text DEFAULT 'mixed',
  _payment_details jsonb DEFAULT '{}'::jsonb,
  _client_request_id text DEFAULT NULL,
  _contract_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_rules jsonb; v_bal jsonb;
  v_repass_avail numeric; v_bonus_avail numeric;
  v_need_repass numeric := 0; v_need_bonus numeric := 0;
  v_alloc numeric; v_remaining numeric;
  v_withdrawal uuid; v_primary_contract uuid;
  v_fee numeric; v_net numeric;
  v_before numeric; v_after numeric; v_tx uuid; v_ref text;
  v_existing uuid; v_now timestamptz := now();
  v_local timestamp; v_dow int; v_hour int; v_days int[];
  v_last timestamptz; v_count int; v_expected timestamptz;
  c RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF _source NOT IN ('partnership_repass','network_bonus','mixed') THEN
    RAISE EXCEPTION 'Origem inválida';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pwd:' || v_user::text, 0));

  IF _client_request_id IS NOT NULL THEN
    v_ref := 'withdrawal_request:' || v_user::text || ':' || _client_request_id;
    SELECT id INTO v_existing FROM public.partner_withdrawals WHERE request_ref = v_ref;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('withdrawal_id', v_existing, 'duplicate', true,
        'allocations', (SELECT jsonb_agg(to_jsonb(a)) FROM public.withdrawal_allocations a
                         WHERE a.withdrawal_id = v_existing));
    END IF;
  END IF;

  v_rules := public.partner_get_withdrawal_rules();
  IF NOT (v_rules->>'enabled')::boolean THEN
    RAISE EXCEPTION 'Saques temporariamente indisponíveis';
  END IF;

  v_local := v_now AT TIME ZONE 'America/Sao_Paulo';
  v_dow := EXTRACT(DOW FROM v_local)::int;
  v_hour := EXTRACT(HOUR FROM v_local)::int;
  SELECT array_agg(TRIM(x)::int) INTO v_days
    FROM unnest(string_to_array(v_rules->>'allowed_days', ',')) x WHERE TRIM(x) <> '';
  IF v_days IS NOT NULL AND NOT (v_dow = ANY (v_days)) THEN
    RAISE EXCEPTION 'Fora dos dias permitidos para solicitação de saque';
  END IF;
  IF v_hour < (v_rules->>'start_hour')::int OR v_hour >= (v_rules->>'end_hour')::int THEN
    RAISE EXCEPTION 'Fora do horário permitido (das %h às %h)', v_rules->>'start_hour', v_rules->>'end_hour';
  END IF;
  IF _amount < (v_rules->>'min_amount')::numeric THEN
    RAISE EXCEPTION 'Valor abaixo do mínimo permitido (R$ %)', v_rules->>'min_amount';
  END IF;
  IF (v_rules->>'max_amount')::numeric > 0 AND _amount > (v_rules->>'max_amount')::numeric THEN
    RAISE EXCEPTION 'Valor acima do máximo permitido (R$ %)', v_rules->>'max_amount';
  END IF;

  IF (v_rules->>'min_interval_hours')::numeric > 0 THEN
    SELECT MAX(w.requested_at) INTO v_last
      FROM public.partner_withdrawals w
      JOIN public.partner_contracts pc ON pc.id = w.partner_contract_id
     WHERE pc.user_id = v_user AND w.status <> 'CANCELLED';
    IF v_last IS NOT NULL AND v_last > v_now - (((v_rules->>'min_interval_hours')::numeric)::text || ' hours')::interval THEN
      RAISE EXCEPTION 'Aguarde o intervalo mínimo entre solicitações';
    END IF;
  END IF;

  IF (v_rules->>'max_requests')::int > 0 THEN
    SELECT COUNT(*) INTO v_count
      FROM public.partner_withdrawals w
      JOIN public.partner_contracts pc ON pc.id = w.partner_contract_id
     WHERE pc.user_id = v_user AND w.status <> 'CANCELLED'
       AND w.requested_at > v_now - (((v_rules->>'max_requests_period_days')::int)::text || ' days')::interval;
    IF v_count >= (v_rules->>'max_requests')::int THEN
      RAISE EXCEPTION 'Limite de solicitações no período atingido';
    END IF;
  END IF;

  PERFORM 1 FROM public.partner_contracts WHERE user_id = v_user ORDER BY created_at FOR UPDATE;
  PERFORM 1 FROM public.partner_network_wallets WHERE user_id = v_user FOR UPDATE;

  v_bal := public.partner_get_withdrawal_balances(v_user);
  v_repass_avail := (v_bal->>'repass_available')::numeric;
  v_bonus_avail  := (v_bal->>'bonus_available')::numeric;

  IF _source = 'partnership_repass' THEN v_need_repass := _amount;
  ELSIF _source = 'network_bonus' THEN v_need_bonus := _amount;
  ELSE
    v_need_repass := LEAST(_amount, v_repass_avail);
    v_need_bonus  := _amount - v_need_repass;
  END IF;

  IF v_need_repass > v_repass_avail + 0.005 THEN
    RAISE EXCEPTION 'Saldo de repasses insuficiente (disponível: R$ %)', ROUND(v_repass_avail,2);
  END IF;
  IF v_need_bonus > v_bonus_avail + 0.005 THEN
    RAISE EXCEPTION 'Saldo de bônus de rede insuficiente (disponível: R$ %)', ROUND(v_bonus_avail,2);
  END IF;

  SELECT COALESCE(_contract_id, (
    SELECT id FROM public.partner_contracts WHERE user_id = v_user
     ORDER BY (status='ACTIVE') DESC, created_at DESC LIMIT 1))
  INTO v_primary_contract;
  IF v_primary_contract IS NULL THEN
    RAISE EXCEPTION 'Nenhum contrato de parceria encontrado';
  END IF;

  v_fee := ROUND(_amount * COALESCE((v_rules->>'fee_percentage')::numeric,0) / 100.0, 2);
  v_net := _amount - v_fee;
  v_expected := CASE
    WHEN (v_rules->>'analysis_days')::int + (v_rules->>'payment_days')::int > 0
      THEN v_now + ((((v_rules->>'analysis_days')::int + (v_rules->>'payment_days')::int))::text || ' days')::interval
    ELSE NULL END;

  INSERT INTO public.partner_withdrawals (
    partner_contract_id, amount, payment_method, payment_details, status, approved_at,
    fee_percentage, fee_amount, net_amount,
    balance_source, repass_amount, bonus_amount, wallet_user_id, request_ref,
    rules_snapshot, expected_payment_at, withdrawal_flow_version, uses_allocations
  ) VALUES (
    v_primary_contract, _amount, 'pix', COALESCE(_payment_details,'{}'::jsonb), 'APPROVED', v_now,
    COALESCE((v_rules->>'fee_percentage')::numeric,0), v_fee, v_net,
    CASE WHEN v_need_repass > 0 AND v_need_bonus > 0 THEN 'mixed'
         WHEN v_need_bonus > 0 THEN 'network_bonus' ELSE 'partnership_repass' END,
    v_need_repass, v_need_bonus,
    CASE WHEN v_need_bonus > 0 THEN v_user ELSE NULL END,
    v_ref, v_rules, v_expected, 'v2', true
  ) RETURNING id INTO v_withdrawal;

  IF v_need_repass > 0 THEN
    v_remaining := v_need_repass;
    FOR c IN SELECT (x->>'contract_id')::uuid AS contract_id, (x->>'available')::numeric AS available
               FROM jsonb_array_elements(v_bal->'contracts') x
              WHERE (x->>'available')::numeric > 0
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_alloc := LEAST(v_remaining, c.available);
      INSERT INTO public.withdrawal_allocations
        (withdrawal_id, balance_type, contract_id, reserved_amount, source_ref)
      VALUES (v_withdrawal, 'partnership_repass', c.contract_id, v_alloc,
              'withdrawal:' || v_withdrawal::text || ':repass:' || c.contract_id::text);
      v_remaining := v_remaining - v_alloc;
    END LOOP;
    IF ROUND(v_remaining,2) <> 0 THEN
      RAISE EXCEPTION 'Não foi possível compor a parcela de repasses (faltam R$ %)', ROUND(v_remaining,2);
    END IF;
  END IF;

  IF v_need_bonus > 0 THEN
    SELECT available_balance INTO v_before
      FROM public.partner_network_wallets WHERE user_id = v_user FOR UPDATE;
    IF v_before IS NULL THEN RAISE EXCEPTION 'Carteira de bônus inexistente'; END IF;

    UPDATE public.partner_network_wallets
       SET reserved_balance = reserved_balance + v_need_bonus,
           available_balance = ROUND(total_credited + COALESCE(total_adjusted,0)
                                     - total_withdrawn - (reserved_balance + v_need_bonus), 2),
           updated_at = now()
     WHERE user_id = v_user
    RETURNING available_balance INTO v_after;

    INSERT INTO public.partner_network_wallet_transactions (
      wallet_user_id, transaction_type, direction, amount,
      source_type, source_id, source_ref, balance_before, balance_after,
      status, notes, metadata, created_by
    ) VALUES (
      v_user, 'withdrawal_reservation', 'debit', v_need_bonus,
      'partner_withdrawal', v_withdrawal, 'withdrawal_reservation:' || v_withdrawal::text,
      v_before, v_after, 'COMPLETED', 'Reserva de saldo para solicitação de saque',
      jsonb_build_object('withdrawal_id', v_withdrawal, 'balance_source', _source), v_user
    ) RETURNING id INTO v_tx;

    INSERT INTO public.withdrawal_allocations
      (withdrawal_id, balance_type, wallet_user_id, reserved_amount, wallet_transaction_id, source_ref)
    VALUES (v_withdrawal, 'network_bonus', v_user, v_need_bonus, v_tx,
            'withdrawal:' || v_withdrawal::text || ':bonus');
  END IF;

  -- integridade obrigatória da composição v2
  PERFORM public.validate_withdrawal_composition(v_withdrawal, true);

  RETURN jsonb_build_object(
    'withdrawal_id', v_withdrawal,
    'withdrawal_flow_version', 'v2',
    'requested_amount', _amount,
    'withdrawal_fee', v_fee,
    'net_payment_amount', v_net,
    'amount_reserved_from_repasses', v_need_repass,
    'amount_reserved_from_network_bonus', v_need_bonus,
    'expected_payment_at', v_expected,
    'rules_snapshot', v_rules,
    'balance_source', CASE WHEN v_need_repass > 0 AND v_need_bonus > 0 THEN 'mixed'
                           WHEN v_need_bonus > 0 THEN 'network_bonus' ELSE 'partnership_repass' END,
    'allocations', (SELECT jsonb_agg(jsonb_build_object(
                      'balance_type', balance_type, 'contract_id', contract_id,
                      'wallet_user_id', wallet_user_id, 'reserved_amount', reserved_amount,
                      'status', status))
                    FROM public.withdrawal_allocations WHERE withdrawal_id = v_withdrawal)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_request_withdrawal(numeric, text, jsonb, text, uuid) TO authenticated;

-- ============================================================
-- 6) Liquidação: v2 exige composição válida (nunca cai no legado)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_withdrawal_settlement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_bonus numeric; v_wuser uuid; v_before numeric; v_after numeric; v_ref text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('PAID','REJECTED','CANCELLED') THEN RETURN NEW; END IF;

  IF NEW.withdrawal_flow_version = 'v2' THEN
    PERFORM public.validate_withdrawal_composition(NEW.id, true);
  END IF;

  PERFORM set_config('app.alloc_engine','on', true);

  SELECT a.reserved_amount, a.wallet_user_id INTO v_bonus, v_wuser
    FROM public.withdrawal_allocations a
   WHERE a.withdrawal_id = NEW.id AND a.balance_type='network_bonus' AND a.status='RESERVED';

  IF NEW.status = 'PAID' THEN
    UPDATE public.withdrawal_allocations
       SET status='CONFIRMED', confirmed_amount = reserved_amount, confirmed_at = now()
     WHERE withdrawal_id = NEW.id AND status='RESERVED';

    IF v_bonus IS NOT NULL AND v_bonus > 0 THEN
      v_ref := 'withdrawal_settlement:' || NEW.id::text;
      IF NOT EXISTS (SELECT 1 FROM public.partner_network_wallet_transactions WHERE source_ref = v_ref) THEN
        SELECT available_balance INTO v_before FROM public.partner_network_wallets
          WHERE user_id = v_wuser FOR UPDATE;
        UPDATE public.partner_network_wallets
           SET reserved_balance = reserved_balance - v_bonus,
               total_withdrawn = total_withdrawn + v_bonus,
               updated_at = now()
         WHERE user_id = v_wuser
        RETURNING available_balance INTO v_after;

        INSERT INTO public.partner_network_wallet_transactions (
          wallet_user_id, transaction_type, direction, amount, source_type, source_id, source_ref,
          balance_before, balance_after, status, notes, metadata, created_by
        ) VALUES (
          v_wuser, 'withdrawal_settlement', 'debit', v_bonus, 'partner_withdrawal', NEW.id, v_ref,
          v_before, v_after, 'COMPLETED',
          'Pagamento confirmado — reserva convertida em saque definitivo',
          jsonb_build_object('withdrawal_id', NEW.id), auth.uid()
        );
      END IF;
    END IF;

  ELSE
    UPDATE public.withdrawal_allocations
       SET status='RELEASED', released_at = now()
     WHERE withdrawal_id = NEW.id AND status='RESERVED';

    IF v_bonus IS NOT NULL AND v_bonus > 0 THEN
      v_ref := 'withdrawal_release:' || NEW.id::text;
      IF NOT EXISTS (SELECT 1 FROM public.partner_network_wallet_transactions WHERE source_ref = v_ref)
         AND NOT EXISTS (SELECT 1 FROM public.partner_network_wallet_transactions
                          WHERE source_ref = 'withdrawal_settlement:' || NEW.id::text) THEN
        SELECT available_balance INTO v_before FROM public.partner_network_wallets
          WHERE user_id = v_wuser FOR UPDATE;
        UPDATE public.partner_network_wallets
           SET reserved_balance = reserved_balance - v_bonus,
               available_balance = ROUND(total_credited + COALESCE(total_adjusted,0)
                                         - total_withdrawn - (reserved_balance - v_bonus), 2),
               updated_at = now()
         WHERE user_id = v_wuser
        RETURNING available_balance INTO v_after;

        INSERT INTO public.partner_network_wallet_transactions (
          wallet_user_id, transaction_type, direction, amount, source_type, source_id, source_ref,
          balance_before, balance_after, status, notes, metadata, created_by
        ) VALUES (
          v_wuser, 'withdrawal_release', 'credit', v_bonus, 'partner_withdrawal', NEW.id, v_ref,
          v_before, v_after, 'COMPLETED',
          'Liberação de reserva — saque recusado ou cancelado',
          jsonb_build_object('withdrawal_id', NEW.id, 'event', NEW.status), auth.uid()
        );
      END IF;
    END IF;
  END IF;

  PERFORM set_config('app.alloc_engine','off', true);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 7) Ressincronizar contratos com a nova regra
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.partner_contracts LOOP
    PERFORM public.recalc_partner_contract_totals(r.id);
  END LOOP;
END $$;
