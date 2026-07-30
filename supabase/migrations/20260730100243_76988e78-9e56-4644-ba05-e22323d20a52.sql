
-- ============================================================
-- 0) Configurações administrativas (significado do zero documentado)
-- ============================================================
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES
  ('withdrawals_enabled', 'true', 'Saques de parceiro habilitados globalmente (true/false)'),
  ('partner_max_withdrawal', '0', 'Valor máximo por solicitação. 0 = SEM LIMITE MÁXIMO (comportamento atual)'),
  ('withdrawal_min_interval_hours', '0', 'Intervalo mínimo entre solicitações, em horas. 0 = SEM INTERVALO OBRIGATÓRIO (comportamento atual)'),
  ('withdrawal_max_requests_per_period', '0', 'Máximo de solicitações por período. 0 = SEM LIMITE DE QUANTIDADE (comportamento atual)'),
  ('withdrawal_max_requests_period_days', '7', 'Janela em dias usada pelo limite de quantidade de solicitações'),
  ('withdrawal_analysis_days', '0', 'Prazo estimado de ANÁLISE em dias. 0 = PRAZO NÃO INFORMADO (comportamento atual: nenhum prazo divulgado)'),
  ('withdrawal_payment_days', '0', 'Prazo estimado de PAGAMENTO em dias. 0 = PRAZO NÃO INFORMADO (comportamento atual: nenhum prazo divulgado)')
ON CONFLICT (setting_key) DO NOTHING;

UPDATE public.system_settings
   SET description = 'Taxa percentual de saque. 0 = SEM TAXA. Regra atual: percentual DESCONTADO do valor solicitado (parceiro recebe o líquido; a reserva nas origens é sempre o valor bruto)'
 WHERE setting_key = 'withdrawal_fee_percentage';

-- ============================================================
-- 1) Carteira de bônus: reserved_balance + saldo derivado
-- ============================================================
ALTER TABLE public.partner_network_wallet_transactions
  DROP CONSTRAINT IF EXISTS partner_network_wallet_transactions_transaction_type_check;
ALTER TABLE public.partner_network_wallet_transactions
  ADD CONSTRAINT partner_network_wallet_transactions_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY[
    'bonus_credit','withdrawal_debit','withdrawal_reservation','withdrawal_settlement',
    'withdrawal_release','reversal_debit','administrative_credit','administrative_debit','financial_adjustment'
  ]));

ALTER TABLE public.partner_network_wallets
  ADD COLUMN IF NOT EXISTS reserved_balance numeric NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.partner_network_wallets
    ADD CONSTRAINT partner_network_wallets_reserved_balance_check CHECK (reserved_balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.partner_network_wallets.available_balance IS
  'CACHE da fórmula: total_credited + total_adjusted - total_withdrawn - reserved_balance';

CREATE OR REPLACE FUNCTION public.pnw_check_invariant()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.reserved_balance < 0 OR NEW.total_withdrawn < 0 OR NEW.total_credited < 0 THEN
    RAISE EXCEPTION 'Invariante violada: saldo negativo na carteira de bônus';
  END IF;
  IF ROUND(NEW.available_balance,2) <> ROUND(NEW.total_credited + COALESCE(NEW.total_adjusted,0)
                                             - NEW.total_withdrawn - NEW.reserved_balance, 2) THEN
    RAISE EXCEPTION 'Invariante violada: available_balance (%) <> credited + adjusted - withdrawn - reserved (%)',
      NEW.available_balance,
      ROUND(NEW.total_credited + COALESCE(NEW.total_adjusted,0) - NEW.total_withdrawn - NEW.reserved_balance, 2);
  END IF;
  RETURN NEW;
END; $$;

-- alinhar carteiras existentes via total_adjusted antes de ativar a invariante
UPDATE public.partner_network_wallets
   SET total_adjusted = ROUND(available_balance + reserved_balance + total_withdrawn - total_credited, 2)
 WHERE ROUND(available_balance,2)
    <> ROUND(total_credited + COALESCE(total_adjusted,0) - total_withdrawn - reserved_balance, 2);

DROP TRIGGER IF EXISTS trg_pnw_check_invariant ON public.partner_network_wallets;
CREATE TRIGGER trg_pnw_check_invariant
BEFORE INSERT OR UPDATE ON public.partner_network_wallets
FOR EACH ROW EXECUTE FUNCTION public.pnw_check_invariant();

-- ============================================================
-- 2) Contratos: reserved_balance
--    repass_credited  = SUM(partner_payouts PAID, tipo repasse) = total_received
--    repass_withdrawn = partner_contracts.total_withdrawn
--    repass_reserved  = partner_contracts.reserved_balance
-- ============================================================
ALTER TABLE public.partner_contracts
  ADD COLUMN IF NOT EXISTS reserved_balance numeric NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.partner_contracts
    ADD CONSTRAINT partner_contracts_reserved_balance_check CHECK (reserved_balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- auditoria de contratos legados com saque > creditado (anterior à separação)
CREATE TABLE IF NOT EXISTS public.contract_balance_anomalies (
  contract_id uuid PRIMARY KEY REFERENCES public.partner_contracts(id) ON DELETE CASCADE,
  credited numeric NOT NULL,
  withdrawn numeric NOT NULL,
  reserved numeric NOT NULL,
  deficit numeric NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contract_balance_anomalies TO authenticated;
GRANT ALL ON public.contract_balance_anomalies TO service_role;
ALTER TABLE public.contract_balance_anomalies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anomalies_admin_only" ON public.contract_balance_anomalies;
CREATE POLICY "anomalies_admin_only" ON public.contract_balance_anomalies
FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- ============================================================
-- 3) Saque: origem, taxa detalhada, snapshot e idempotência
-- ============================================================
ALTER TABLE public.partner_withdrawals
  ADD COLUMN IF NOT EXISTS balance_source text NOT NULL DEFAULT 'partnership_repass',
  ADD COLUMN IF NOT EXISTS repass_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_user_id uuid,
  ADD COLUMN IF NOT EXISTS request_ref text,
  ADD COLUMN IF NOT EXISTS rules_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS expected_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

COMMENT ON COLUMN public.partner_withdrawals.amount IS 'requested_amount (bruto) — valor reservado nas origens';
COMMENT ON COLUMN public.partner_withdrawals.fee_amount IS 'withdrawal_fee — percentual descontado do valor solicitado';
COMMENT ON COLUMN public.partner_withdrawals.net_amount IS 'net_payment_amount — valor efetivamente pago ao parceiro';
COMMENT ON COLUMN public.partner_withdrawals.repass_amount IS 'amount_reserved_from_repasses';
COMMENT ON COLUMN public.partner_withdrawals.bonus_amount IS 'amount_reserved_from_network_bonus';

DO $$ BEGIN
  ALTER TABLE public.partner_withdrawals
    ADD CONSTRAINT partner_withdrawals_balance_source_chk
    CHECK (balance_source IN ('partnership_repass','network_bonus','mixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.partner_withdrawals
    ADD CONSTRAINT partner_withdrawals_status_chk
    CHECK (status IN ('PENDING','APPROVED','PROCESSING','PAID','REJECTED','CANCELLED','ERROR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_partner_withdrawal_request_ref
  ON public.partner_withdrawals (request_ref) WHERE request_ref IS NOT NULL;

UPDATE public.partner_withdrawals
   SET repass_amount = amount
 WHERE repass_amount = 0 AND bonus_amount = 0;

DROP INDEX IF EXISTS public.uniq_partner_active_withdrawal;
CREATE UNIQUE INDEX uniq_partner_active_withdrawal
  ON public.partner_withdrawals (partner_contract_id)
  WHERE status IN ('PENDING','APPROVED','PROCESSING');

-- ============================================================
-- 4) withdrawal_allocations (composição imutável e auditável)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.partner_withdrawals(id) ON DELETE CASCADE,
  balance_type text NOT NULL CHECK (balance_type IN ('partnership_repass','network_bonus')),
  contract_id uuid REFERENCES public.partner_contracts(id) ON DELETE SET NULL,
  wallet_user_id uuid,
  reserved_amount numeric NOT NULL CHECK (reserved_amount > 0),
  confirmed_amount numeric NOT NULL DEFAULT 0 CHECK (confirmed_amount >= 0),
  status text NOT NULL DEFAULT 'RESERVED',
  wallet_transaction_id uuid,
  source_ref text UNIQUE,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alloc_status_chk CHECK (status IN ('RESERVED','CONFIRMED','RELEASED')),
  CONSTRAINT alloc_repass_needs_contract CHECK (balance_type <> 'partnership_repass' OR contract_id IS NOT NULL),
  CONSTRAINT alloc_bonus_needs_wallet CHECK (balance_type <> 'network_bonus' OR wallet_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_alloc_withdrawal ON public.withdrawal_allocations (withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_alloc_contract ON public.withdrawal_allocations (contract_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_alloc_wallet ON public.withdrawal_allocations (wallet_user_id, status);

GRANT SELECT ON public.withdrawal_allocations TO authenticated;
GRANT ALL ON public.withdrawal_allocations TO service_role;
ALTER TABLE public.withdrawal_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alloc_owner_select" ON public.withdrawal_allocations;
CREATE POLICY "alloc_owner_select" ON public.withdrawal_allocations
FOR SELECT TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR wallet_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.partner_contracts pc
              WHERE pc.id = withdrawal_allocations.contract_id AND pc.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.withdrawal_allocations_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('app.alloc_engine', true) <> 'on' THEN
    RAISE EXCEPTION 'Composição do saque não pode ser alterada diretamente';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Composição do saque não pode ser excluída';
  END IF;
  IF NEW.withdrawal_id IS DISTINCT FROM OLD.withdrawal_id
     OR NEW.balance_type IS DISTINCT FROM OLD.balance_type
     OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
     OR NEW.wallet_user_id IS DISTINCT FROM OLD.wallet_user_id
     OR NEW.reserved_amount IS DISTINCT FROM OLD.reserved_amount THEN
    RAISE EXCEPTION 'Composição imutável: apenas status e confirmação podem mudar';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_withdrawal_allocations_immutable ON public.withdrawal_allocations;
CREATE TRIGGER trg_withdrawal_allocations_immutable
BEFORE UPDATE OR DELETE ON public.withdrawal_allocations
FOR EACH ROW EXECUTE FUNCTION public.withdrawal_allocations_immutable();

-- ============================================================
-- 5) Sincronização dos totais do contrato (legado registrado, não bloqueia)
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

  SELECT COALESCE(SUM(a.confirmed_amount),0) INTO v_withdrawn
    FROM public.withdrawal_allocations a
   WHERE a.contract_id = _contract_id AND a.status = 'CONFIRMED';

  v_withdrawn := v_withdrawn + COALESCE((
    SELECT SUM(w.amount) FROM public.partner_withdrawals w
     WHERE w.partner_contract_id = _contract_id AND w.status='PAID'
       AND NOT EXISTS (SELECT 1 FROM public.withdrawal_allocations a2 WHERE a2.withdrawal_id = w.id)),0);

  SELECT COALESCE(SUM(a.reserved_amount),0) INTO v_reserved
    FROM public.withdrawal_allocations a
   WHERE a.contract_id = _contract_id AND a.status = 'RESERVED';

  v_reserved := v_reserved + COALESCE((
    SELECT SUM(w.amount) FROM public.partner_withdrawals w
     WHERE w.partner_contract_id = _contract_id
       AND w.status IN ('PENDING','APPROVED','PROCESSING')
       AND NOT EXISTS (SELECT 1 FROM public.withdrawal_allocations a2 WHERE a2.withdrawal_id = w.id)),0);

  v_avail := ROUND(v_credited - v_withdrawn - v_reserved, 2);

  IF v_avail < -0.005 THEN
    -- resíduo histórico (saques antigos que incluíam bônus de rede): registrar e seguir
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

CREATE OR REPLACE FUNCTION public.trg_alloc_sync_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF COALESCE(NEW.balance_type, OLD.balance_type) = 'partnership_repass' THEN
    PERFORM public.recalc_partner_contract_totals(COALESCE(NEW.contract_id, OLD.contract_id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_alloc_sync_contract ON public.withdrawal_allocations;
CREATE TRIGGER trg_alloc_sync_contract
AFTER INSERT OR UPDATE OF status ON public.withdrawal_allocations
FOR EACH ROW EXECUTE FUNCTION public.trg_alloc_sync_contract();

-- ============================================================
-- 6) Regras administrativas (fonte oficial única)
-- ============================================================
CREATE OR REPLACE FUNCTION public.partner_get_withdrawal_rules()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE((SELECT setting_value FROM system_settings WHERE setting_key='withdrawals_enabled'),'true') = 'true',
    'allowed_days', COALESCE((SELECT setting_value FROM system_settings WHERE setting_key='withdrawal_allowed_days'),'1'),
    'start_hour', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_start_hour'),8),
    'end_hour', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_end_hour'),18),
    'fee_mode', 'percentage_deducted_from_requested',
    'fee_percentage', COALESCE((SELECT setting_value::numeric FROM system_settings WHERE setting_key='withdrawal_fee_percentage'),0),
    'min_amount', COALESCE((SELECT setting_value::numeric FROM system_settings WHERE setting_key='partner_min_withdrawal'),0),
    'max_amount', COALESCE((SELECT setting_value::numeric FROM system_settings WHERE setting_key='partner_max_withdrawal'),0),
    'min_interval_hours', COALESCE((SELECT setting_value::numeric FROM system_settings WHERE setting_key='withdrawal_min_interval_hours'),0),
    'max_requests', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_max_requests_per_period'),0),
    'max_requests_period_days', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_max_requests_period_days'),7),
    'analysis_days', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_analysis_days'),0),
    'payment_days', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_payment_days'),0),
    'captured_at', now()
  );
$$;
GRANT EXECUTE ON FUNCTION public.partner_get_withdrawal_rules() TO authenticated;

-- ============================================================
-- 7) Saldos separados (fórmulas oficiais)
-- ============================================================
CREATE OR REPLACE FUNCTION public.partner_get_withdrawal_balances(_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := COALESCE(_user_id, auth.uid());
  v_contracts jsonb := '[]'::jsonb;
  v_credited numeric := 0; v_reserved numeric := 0; v_withdrawn numeric := 0;
  v_avail_sum numeric := 0; v_wallet RECORD; r RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF v_user <> COALESCE(auth.uid(), v_user) AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR r IN
    SELECT pc.id, pc.status, pc.total_received, pc.total_cap,
           COALESCE(pc.total_withdrawn,0) AS withdrawn,
           COALESCE(pc.reserved_balance,0) AS reserved,
           COALESCE((SELECT SUM(p.amount) FROM public.partner_payouts p
                      WHERE p.partner_contract_id = pc.id AND p.status='PAID'
                        AND COALESCE(p.payout_type,'partnership_weekly_repass')='partnership_weekly_repass'),0) AS credited
      FROM public.partner_contracts pc
     WHERE pc.user_id = v_user
     ORDER BY pc.created_at
  LOOP
    v_credited := v_credited + r.credited;
    v_reserved := v_reserved + r.reserved;
    v_withdrawn := v_withdrawn + r.withdrawn;
    v_avail_sum := v_avail_sum + GREATEST(0, ROUND(r.credited - r.withdrawn - r.reserved, 2));
    v_contracts := v_contracts || jsonb_build_object(
      'contract_id', r.id, 'contract_status', r.status,
      'total_received', r.total_received, 'total_cap', r.total_cap,
      'cap_remaining', GREATEST(0, COALESCE(r.total_cap,0) - COALESCE(r.total_received,0)),
      'repass_credited', r.credited,
      'repass_withdrawn', r.withdrawn,
      'repass_reserved', r.reserved,
      'available', GREATEST(0, ROUND(r.credited - r.withdrawn - r.reserved, 2)));
  END LOOP;

  SELECT * INTO v_wallet FROM public.partner_network_wallets WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'user_id', v_user,
    'contracts', v_contracts,
    'repass_credited', v_credited,
    'repass_total', v_credited,
    'repass_reserved', v_reserved,
    'repass_withdrawn', v_withdrawn,
    'repass_available', v_avail_sum,
    'bonus_total_credited', COALESCE(v_wallet.total_credited,0),
    'bonus_total_adjusted', COALESCE(v_wallet.total_adjusted,0),
    'bonus_total_withdrawn', COALESCE(v_wallet.total_withdrawn,0),
    'bonus_reserved', COALESCE(v_wallet.reserved_balance,0),
    'bonus_available', COALESCE(v_wallet.available_balance,0),
    'bonus_total', COALESCE(v_wallet.available_balance,0) + COALESCE(v_wallet.reserved_balance,0),
    'bonus_by_type', COALESCE((
      SELECT jsonb_object_agg(bt, total) FROM (
        SELECT COALESCE(bonus_type,'other') AS bt, SUM(amount) AS total
          FROM public.partner_network_wallet_transactions
         WHERE wallet_user_id = v_user AND direction='credit' AND status='COMPLETED'
           AND transaction_type IN ('bonus_credit','administrative_credit')
         GROUP BY 1) t), '{}'::jsonb),
    'total_reserved', v_reserved + COALESCE(v_wallet.reserved_balance,0),
    'total_available', v_avail_sum + COALESCE(v_wallet.available_balance,0)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_get_withdrawal_balances(uuid) TO authenticated;

-- ============================================================
-- 8) Rotina oficial de solicitação (transação única + locks)
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

  -- locks das origens antes de recalcular saldos
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

  -- taxa: percentual descontada do valor solicitado (regra atual preservada)
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
    rules_snapshot, expected_payment_at
  ) VALUES (
    v_primary_contract, _amount, 'pix', COALESCE(_payment_details,'{}'::jsonb), 'APPROVED', v_now,
    COALESCE((v_rules->>'fee_percentage')::numeric,0), v_fee, v_net,
    CASE WHEN v_need_repass > 0 AND v_need_bonus > 0 THEN 'mixed'
         WHEN v_need_bonus > 0 THEN 'network_bonus' ELSE 'partnership_repass' END,
    v_need_repass, v_need_bonus,
    CASE WHEN v_need_bonus > 0 THEN v_user ELSE NULL END,
    v_ref, v_rules, v_expected
  ) RETURNING id INTO v_withdrawal;

  -- reserva de repasses: contratos mais antigos primeiro
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

  -- reserva de bônus: só reserved_balance aumenta; disponível é derivado
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

  IF ROUND((SELECT COALESCE(SUM(reserved_amount),0) FROM public.withdrawal_allocations
             WHERE withdrawal_id = v_withdrawal),2) <> ROUND(_amount,2) THEN
    RAISE EXCEPTION 'Composição inconsistente com o valor solicitado';
  END IF;

  RETURN jsonb_build_object(
    'withdrawal_id', v_withdrawal,
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
-- 9) Transições de status válidas
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_withdrawal_status_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_ok boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  v_ok := (OLD.status, NEW.status) IN (
    ('PENDING','APPROVED'), ('PENDING','PROCESSING'), ('PENDING','REJECTED'), ('PENDING','CANCELLED'),
    ('APPROVED','PROCESSING'), ('APPROVED','PAID'), ('APPROVED','REJECTED'), ('APPROVED','CANCELLED'),
    ('PROCESSING','PAID'), ('PROCESSING','ERROR'), ('PROCESSING','REJECTED'),
    ('ERROR','PROCESSING'), ('ERROR','CANCELLED')
  );
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Transição de status inválida: % -> %', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'PAID' AND NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
  IF NEW.status = 'CANCELLED' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_withdrawal_status_guard ON public.partner_withdrawals;
CREATE TRIGGER trg_withdrawal_status_guard
BEFORE UPDATE OF status ON public.partner_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.trg_withdrawal_status_guard();

-- ============================================================
-- 10) Pagamento / recusa / cancelamento (uma única vez cada)
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

  ELSE -- REJECTED / CANCELLED
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

DROP TRIGGER IF EXISTS trg_withdrawal_wallet_settlement ON public.partner_withdrawals;
DROP TRIGGER IF EXISTS trg_withdrawal_settlement ON public.partner_withdrawals;
CREATE TRIGGER trg_withdrawal_settlement
AFTER UPDATE OF status ON public.partner_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.trg_withdrawal_settlement();

-- ============================================================
-- 11) Sincronizar reserved_balance dos contratos existentes
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.partner_contracts LOOP
    PERFORM public.recalc_partner_contract_totals(r.id);
  END LOOP;
END $$;
