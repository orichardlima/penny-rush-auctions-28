-- ============================================================================
-- PROGRAMA PONTOS SHOW — Fase 3 v2 (BRANCH — NÃO APLICAR EM PRODUÇÃO)
--
-- Correções aplicadas em relação à v1:
--   (1) Separação entre elegibilidade FINANCEIRA (lote) e AUDIÊNCIA (bid).
--   (2) Reversão SEM wallet negativa — tabela points_reversal_cases.
--   (3) Timestamp do pagamento vem do gateway (nunca now()); estado
--       'pending_reconciliation' quando ausente.
--   (4) Ativação atômica: RPC points_admin_activate_pilot(...).
--   (5) Imutabilidade completa de points_rules (UPDATE material, DELETE,
--       mudança de active_from, reuso de versão).
--   (6) Guard do trigger via set_config LOCAL dentro da RPC + verificação
--       pós-operação (delta em bids_balance == initial_amount do lote).
--   (7) Cobertura de teste ampliada (Deno smoke test).
--
-- Segurança operacional:
--   * Idempotente (IF NOT EXISTS / OR REPLACE em tudo).
--   * Sem backfill.
--   * Sem alteração de flags.
--   * Não define points_accrual_started_at.
--   * audience_mode nasce em 'off'.
-- ============================================================================

BEGIN;

-- ─── 0. HELPERS ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.points_is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.is_admin_user(_uid), false)
$$;

-- ─── 1. REGRA CANÔNICA VERSIONADA + IMUTÁVEL ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.points_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code         text NOT NULL,
  version           integer NOT NULL,
  bids_per_point    integer NOT NULL CHECK (bids_per_point > 0),
  points_per_block  integer NOT NULL CHECK (points_per_block > 0),
  multiplier        numeric NOT NULL DEFAULT 1 CHECK (multiplier > 0),
  is_active         boolean NOT NULL DEFAULT false,
  active_from       timestamptz NULL,
  active_until      timestamptz NULL,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid NULL,
  UNIQUE (rule_code, version)
);
GRANT SELECT ON public.points_rules TO authenticated;
GRANT ALL    ON public.points_rules TO service_role;
ALTER TABLE public.points_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='points_rules' AND policyname='read rules') THEN
    CREATE POLICY "read rules" ON public.points_rules FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS points_rules_one_active_per_code
  ON public.points_rules (rule_code) WHERE is_active;

-- Bids referenciam a regra usada no momento (snapshot atômico)
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS points_rule_id uuid NULL REFERENCES public.points_rules(id);

-- Função utilitária: existe algo vinculado a esta regra?
CREATE OR REPLACE FUNCTION public.points_rule_has_dependencies(_rule_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
       EXISTS (SELECT 1 FROM public.bids           WHERE points_rule_id = _rule_id)
    OR EXISTS (SELECT 1 FROM public.points_accrual_buckets WHERE rule_id = _rule_id)
    OR EXISTS (SELECT 1 FROM public.points_ledger  WHERE metadata ? 'rule_id' AND (metadata->>'rule_id')::uuid = _rule_id)
$$;

-- Imutabilidade completa: bloqueia UPDATE material E DELETE se há dependências
CREATE OR REPLACE FUNCTION public.points_rules_prevent_material_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.rule_code, NEW.version, NEW.bids_per_point, NEW.points_per_block,
      NEW.multiplier, NEW.active_from)
   IS DISTINCT FROM
     (OLD.rule_code, OLD.version, OLD.bids_per_point, OLD.points_per_block,
      OLD.multiplier, OLD.active_from)
  THEN
    IF public.points_rule_has_dependencies(OLD.id) THEN
      RAISE EXCEPTION 'points_rules % v% é imutável: já existem bids/buckets/ledger vinculados',
        OLD.rule_code, OLD.version USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  -- Retroatividade de active_from após ativada é sempre proibida
  IF OLD.is_active AND NEW.active_from IS DISTINCT FROM OLD.active_from THEN
    RAISE EXCEPTION 'points_rules: active_from não pode mudar após ativação' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.points_rules_prevent_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.points_rule_has_dependencies(OLD.id) THEN
    RAISE EXCEPTION 'points_rules % v% não pode ser removida: existem dependências',
      OLD.rule_code, OLD.version USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_points_rules_immutable ON public.points_rules;
CREATE TRIGGER trg_points_rules_immutable
  BEFORE UPDATE ON public.points_rules
  FOR EACH ROW EXECUTE FUNCTION public.points_rules_prevent_material_update();

DROP TRIGGER IF EXISTS trg_points_rules_no_delete ON public.points_rules;
CREATE TRIGGER trg_points_rules_no_delete
  BEFORE DELETE ON public.points_rules
  FOR EACH ROW EXECUTE FUNCTION public.points_rules_prevent_delete();

-- Semente 12:1 — INATIVA, sem active_from
INSERT INTO public.points_rules (rule_code, version, bids_per_point, points_per_block, multiplier, is_active, metadata)
VALUES ('POINTS_STANDARD', 1, 12, 1, 1, false,
        jsonb_build_object('seeded_by_migration','points-phase3-v2','notes','regra canônica inicial, nasce inativa'))
ON CONFLICT (rule_code, version) DO NOTHING;

-- ─── 2. bid_lots — elegibilidade FINANCEIRA + metadados de pagamento ────────
ALTER TABLE public.bid_lots
  ADD COLUMN IF NOT EXISTS payment_environment       text NULL,
  ADD COLUMN IF NOT EXISTS payment_gateway           text NULL,
  ADD COLUMN IF NOT EXISTS gateway_account_id        text NULL,
  ADD COLUMN IF NOT EXISTS external_payment_id       text NULL,
  ADD COLUMN IF NOT EXISTS gateway_event_id          text NULL,
  ADD COLUMN IF NOT EXISTS gateway_payload_hash      text NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key           text NULL,
  ADD COLUMN IF NOT EXISTS bid_purchase_id           uuid NULL,
  ADD COLUMN IF NOT EXISTS payment_created_at        timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at      timestamptz NULL,
  ADD COLUMN IF NOT EXISTS webhook_received_at       timestamptz NULL,
  ADD COLUMN IF NOT EXISTS processed_at              timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payment_eligible_for_points boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credited_via_canonical_rpc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lot_status text NOT NULL DEFAULT 'active'
    CHECK (lot_status IN ('active','pending_reconciliation','disputed','reversed','cancelled'));

COMMENT ON COLUMN public.bid_lots.payment_eligible_for_points IS
  'ELEGIBILIDADE FINANCEIRA APENAS. Independe de audiência. True quando: '
  'source=paid_purchase, pagamento confirmado, payment_confirmed_at >= corte '
  'no momento do crédito, sem estorno/chargeback, identidade validada.';

COMMENT ON COLUMN public.bid_lots.eligible_for_points IS
  'DEPRECATED em favor de payment_eligible_for_points. Mantido para compat.';

CREATE UNIQUE INDEX IF NOT EXISTS bid_lots_idempotency_key_uidx
  ON public.bid_lots (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bid_lots_payment_ident_uidx
  ON public.bid_lots (payment_environment, payment_gateway, gateway_account_id, external_payment_id)
  WHERE payment_environment IS NOT NULL
    AND payment_gateway     IS NOT NULL
    AND external_payment_id IS NOT NULL;

-- ─── 3. bid_purchases — metadados de pagamento e marcadores canônicos ───────
ALTER TABLE public.bid_purchases
  ADD COLUMN IF NOT EXISTS payment_environment       text NULL,
  ADD COLUMN IF NOT EXISTS gateway_account_id        text NULL,
  ADD COLUMN IF NOT EXISTS gateway_event_id          text NULL,
  ADD COLUMN IF NOT EXISTS gateway_payload_hash      text NULL,
  ADD COLUMN IF NOT EXISTS payment_created_at        timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at      timestamptz NULL,
  ADD COLUMN IF NOT EXISTS webhook_received_at       timestamptz NULL,
  ADD COLUMN IF NOT EXISTS processed_at              timestamptz NULL,
  ADD COLUMN IF NOT EXISTS credited_via_canonical_rpc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canonical_lot_id          uuid NULL REFERENCES public.bid_lots(id);

-- ─── 4. AUDIÊNCIA EXPLÍCITA ─────────────────────────────────────────────────
INSERT INTO public.points_program_settings_json (key, value, is_admin_only)
VALUES ('audience_mode',    jsonb_build_object('mode','off'), true),
       ('audience_version', jsonb_build_object('version', 1), true),
       ('pilot_audience',   jsonb_build_object('user_ids', '[]'::jsonb), true),
       ('webhooks_validated', jsonb_build_object('validated', false, 'validated_at', null), true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.points_audience_mode()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((value->>'mode'), 'off')
  FROM public.points_program_settings_json WHERE key = 'audience_mode';
$$;
REVOKE ALL ON FUNCTION public.points_audience_mode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.points_audience_mode() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.points_audience_version()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((value->>'version')::int, 1)
  FROM public.points_program_settings_json WHERE key = 'audience_version';
$$;

-- Usuário está na audiência elegível no momento do bid?
CREATE OR REPLACE FUNCTION public.points_user_in_audience(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mode text := public.points_audience_mode();
  v_ids  jsonb;
BEGIN
  IF v_mode = 'off'  THEN RETURN false; END IF;
  IF v_mode = 'all'  THEN RETURN true;  END IF;
  IF v_mode = 'pilot' THEN
    SELECT value->'user_ids' INTO v_ids
      FROM public.points_program_settings_json WHERE key='pilot_audience';
    RETURN v_ids ? _user_id::text;
  END IF;
  RETURN false;
END $$;

-- ─── 5. RPC CANÔNICA credit_paid_bid_purchase (com set_config LOCAL) ────────
CREATE OR REPLACE FUNCTION public.credit_paid_bid_purchase(
  p_user_id              uuid,
  p_bid_purchase_id      uuid,
  p_bids_amount          integer,
  p_amount_paid          numeric,
  p_payment_environment  text,
  p_payment_gateway      text,
  p_gateway_account_id   text,
  p_external_payment_id  text,
  p_gateway_event_id     text,
  p_gateway_payload_hash text,
  p_payment_created_at   timestamptz,
  p_payment_confirmed_at timestamptz,
  p_webhook_received_at  timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lock_key      bigint;
  v_purchase      record;
  v_idem          text;
  v_existing_lot  uuid;
  v_new_lot_id    uuid;
  v_cutoff        timestamptz;
  v_pay_eligible  boolean := false;
  v_lot_status    text    := 'active';
  v_old_balance   integer;
  v_new_balance   integer;
BEGIN
  -- Validação de argumentos
  IF p_user_id IS NULL OR p_bid_purchase_id IS NULL OR p_bids_amount IS NULL OR p_bids_amount <= 0 THEN
    RAISE EXCEPTION 'credit_paid_bid_purchase: argumentos inválidos' USING ERRCODE='invalid_parameter_value';
  END IF;
  IF p_payment_environment IS NULL OR p_payment_gateway IS NULL OR p_external_payment_id IS NULL THEN
    RAISE EXCEPTION 'credit_paid_bid_purchase: identidade do pagamento obrigatória' USING ERRCODE='invalid_parameter_value';
  END IF;

  v_idem := 'lot:' || p_payment_environment || ':' || p_payment_gateway || ':'
         || COALESCE(p_gateway_account_id,'-') || ':' || p_external_payment_id;

  -- 1) Idempotência first-pass (sem lock)
  SELECT id INTO v_existing_lot FROM public.bid_lots WHERE idempotency_key = v_idem LIMIT 1;
  IF v_existing_lot IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'lot_id', v_existing_lot, 'reason','already_credited');
  END IF;

  -- 2) Advisory lock por bid_purchase
  v_lock_key := ('x' || substr(md5(p_bid_purchase_id::text),1,15))::bit(60)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 3) Bloqueia a compra e valida
  SELECT * INTO v_purchase FROM public.bid_purchases WHERE id = p_bid_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bid_purchase % não encontrada', p_bid_purchase_id USING ERRCODE='no_data_found';
  END IF;
  IF v_purchase.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'user_id divergente' USING ERRCODE='check_violation';
  END IF;
  IF v_purchase.bids_purchased IS DISTINCT FROM p_bids_amount THEN
    RAISE EXCEPTION 'bids_amount divergente (esperado %, recebido %)',
      v_purchase.bids_purchased, p_bids_amount USING ERRCODE='check_violation';
  END IF;

  -- Recheca dentro do lock
  SELECT id INTO v_existing_lot FROM public.bid_lots WHERE idempotency_key = v_idem LIMIT 1;
  IF v_existing_lot IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'lot_id', v_existing_lot, 'reason','already_credited_race');
  END IF;

  -- 4) Timestamp confiável do gateway?
  IF p_payment_confirmed_at IS NULL THEN
    -- pending_reconciliation: lote não utilizável pelo programa até confirmação
    v_lot_status   := 'pending_reconciliation';
    v_pay_eligible := false;
  ELSE
    SELECT value INTO v_cutoff FROM public.points_program_settings_time WHERE key='points_accrual_started_at';
    v_pay_eligible := (
      v_cutoff IS NOT NULL
      AND p_payment_confirmed_at >= v_cutoff
      AND COALESCE(v_purchase.payment_status,'') = 'completed'
    );
  END IF;

  -- 5) Marca sessão para o trigger legado (LOCAL à transação)
  PERFORM set_config('points.canonical_credit_active', p_bid_purchase_id::text, true);

  -- 6) Snapshot do saldo antes
  SELECT COALESCE(bids_balance,0) INTO v_old_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- 7) Insere lote canônico
  INSERT INTO public.bid_lots (
    user_id, source, initial_amount, remaining_amount,
    bid_purchase_id, payment_environment, payment_gateway, gateway_account_id,
    external_payment_id, gateway_event_id, gateway_payload_hash, idempotency_key,
    payment_created_at, payment_confirmed_at, webhook_received_at, processed_at,
    payment_eligible_for_points, eligible_for_points,
    credited_via_canonical_rpc, lot_status
  ) VALUES (
    p_user_id, 'paid_purchase', p_bids_amount, p_bids_amount,
    p_bid_purchase_id, p_payment_environment, p_payment_gateway, p_gateway_account_id,
    p_external_payment_id, p_gateway_event_id, p_gateway_payload_hash, v_idem,
    p_payment_created_at, p_payment_confirmed_at, p_webhook_received_at, now(),
    v_pay_eligible, v_pay_eligible,  -- eligible_for_points legado espelha (compat)
    true, v_lot_status
  ) RETURNING id INTO v_new_lot_id;

  -- 8) Credita bids_balance (o trigger legado deve NÃO criar 'unknown', vide GUC)
  UPDATE public.profiles
     SET bids_balance = COALESCE(bids_balance,0) + p_bids_amount
   WHERE id = p_user_id
   RETURNING bids_balance INTO v_new_balance;

  -- 9) Verificação pós-op: delta deve casar exatamente com initial_amount
  IF (v_new_balance - v_old_balance) <> p_bids_amount THEN
    RAISE EXCEPTION 'credit_paid_bid_purchase: divergência de saldo (delta=% esperado=%)',
      (v_new_balance - v_old_balance), p_bids_amount USING ERRCODE='data_exception';
  END IF;

  -- 10) Marca compra
  UPDATE public.bid_purchases
     SET credited_via_canonical_rpc = true,
         canonical_lot_id           = v_new_lot_id,
         payment_confirmed_at       = COALESCE(payment_confirmed_at, p_payment_confirmed_at),
         webhook_received_at        = COALESCE(webhook_received_at,  p_webhook_received_at),
         processed_at               = now(),
         payment_environment        = COALESCE(payment_environment,  p_payment_environment),
         gateway_account_id         = COALESCE(gateway_account_id,   p_gateway_account_id),
         gateway_event_id           = COALESCE(gateway_event_id,     p_gateway_event_id),
         gateway_payload_hash       = COALESCE(gateway_payload_hash, p_gateway_payload_hash)
   WHERE id = p_bid_purchase_id;

  RETURN jsonb_build_object(
    'idempotent', false,
    'lot_id', v_new_lot_id,
    'payment_eligible_for_points', v_pay_eligible,
    'lot_status', v_lot_status
  );
END $$;

REVOKE ALL ON FUNCTION public.credit_paid_bid_purchase(
  uuid,uuid,integer,numeric,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_paid_bid_purchase(
  uuid,uuid,integer,numeric,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz
) FROM anon, authenticated;
-- service_role bypassa RLS/GRANTs

-- ─── 6. GUARD do trigger legado (LOCAL à transação, não configurável pelo FE)
CREATE OR REPLACE FUNCTION public.points_canonical_credit_active()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  BEGIN v := current_setting('points.canonical_credit_active', true); EXCEPTION WHEN OTHERS THEN v := NULL; END;
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN v::uuid;
END $$;
REVOKE ALL ON FUNCTION public.points_canonical_credit_active() FROM PUBLIC;

-- ─── 7. REVERSÃO SEM WALLET NEGATIVA ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.points_reversal_cases (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  payment_id         text NULL,           -- external_payment_id do gateway
  bid_purchase_id    uuid NULL REFERENCES public.bid_purchases(id),
  lot_id             uuid NULL REFERENCES public.bid_lots(id),
  settlement_id      uuid NULL,
  points_to_reverse  integer NOT NULL DEFAULT 0 CHECK (points_to_reverse >= 0),
  points_recovered   integer NOT NULL DEFAULT 0 CHECK (points_recovered  >= 0),
  points_outstanding integer NOT NULL DEFAULT 0 CHECK (points_outstanding>= 0),
  status             text    NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','PARTIALLY_RECOVERED','UNDER_REVIEW','RESOLVED','WAIVED')),
  reason             text    NULL,
  metadata           jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz NULL,
  resolved_by        uuid NULL
);
GRANT ALL ON public.points_reversal_cases TO service_role;
ALTER TABLE public.points_reversal_cases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='points_reversal_cases' AND policyname='admin read cases') THEN
    CREATE POLICY "admin read cases" ON public.points_reversal_cases FOR SELECT TO authenticated
      USING (public.points_is_admin(auth.uid()));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payment_reversal_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_lot_id         uuid NULL REFERENCES public.bid_lots(id),
  bid_purchase_id    uuid NULL REFERENCES public.bid_purchases(id),
  reversal_case_id   uuid NULL REFERENCES public.points_reversal_cases(id),
  reversal_type      text NOT NULL CHECK (reversal_type IN ('cancelled','refunded','chargeback','partial_refund','duplicate')),
  gateway_event_id   text NULL,
  amount             numeric NULL,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','under_review','rejected')),
  notes              text NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  applied_at         timestamptz NULL
);
GRANT ALL ON public.payment_reversal_events TO service_role;
ALTER TABLE public.payment_reversal_events ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS payment_reversal_events_gateway_uidx
  ON public.payment_reversal_events (gateway_event_id) WHERE gateway_event_id IS NOT NULL;

-- Guard: nenhuma linha de ledger pode deixar wallet negativa
CREATE OR REPLACE FUNCTION public.points_ledger_prevent_negative_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_after_available integer; v_after_reserved integer; v_after_blocked integer;
BEGIN
  SELECT
      COALESCE(SUM(CASE WHEN column_kind='available' THEN amt ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN column_kind='reserved'  THEN amt ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN column_kind='blocked'   THEN amt ELSE 0 END),0)
  INTO v_after_available, v_after_reserved, v_after_blocked
  FROM (
    SELECT 'available'::text AS column_kind, COALESCE(available_points,0) AS amt
      FROM public.points_wallets WHERE user_id = NEW.user_id
    UNION ALL SELECT 'reserved', COALESCE(reserved_points,0) FROM public.points_wallets WHERE user_id = NEW.user_id
    UNION ALL SELECT 'blocked',  COALESCE(blocked_points,0)  FROM public.points_wallets WHERE user_id = NEW.user_id
  ) s;
  IF v_after_available < 0 OR v_after_reserved < 0 OR v_after_blocked < 0 THEN
    RAISE EXCEPTION 'wallet negativa proibida (user=%, avail=%, res=%, blk=%)',
      NEW.user_id, v_after_available, v_after_reserved, v_after_blocked
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_points_wallet_no_negative ON public.points_wallets;
CREATE TRIGGER trg_points_wallet_no_negative
  AFTER INSERT OR UPDATE ON public.points_wallets
  FOR EACH ROW EXECUTE FUNCTION public.points_ledger_prevent_negative_wallet();

-- RPC de reversão que NUNCA deixa wallet negativa
CREATE OR REPLACE FUNCTION public.reverse_paid_bid_purchase(
  p_bid_purchase_id  uuid,
  p_reversal_type    text,
  p_gateway_event_id text,
  p_amount           numeric DEFAULT NULL,
  p_notes            text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lot        record;
  v_consumed   integer;
  v_wallet     record;
  v_granted    integer := 0;   -- pontos já concedidos por este lote
  v_recover    integer := 0;   -- pontos efetivamente debitáveis (sem negativar)
  v_outstand   integer := 0;
  v_case_id    uuid;
  v_case_stat  text;
BEGIN
  IF p_reversal_type NOT IN ('cancelled','refunded','chargeback','partial_refund','duplicate') THEN
    RAISE EXCEPTION 'reversal_type inválido' USING ERRCODE='invalid_parameter_value';
  END IF;

  -- Idempotência por gateway_event_id
  IF p_gateway_event_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.payment_reversal_events WHERE gateway_event_id = p_gateway_event_id) THEN
    RETURN jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO v_lot FROM public.bid_lots
    WHERE bid_purchase_id = p_bid_purchase_id
      AND credited_via_canonical_rpc = true
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payment_reversal_events (bid_purchase_id, reversal_type, gateway_event_id, amount, status, notes)
      VALUES (p_bid_purchase_id, p_reversal_type, p_gateway_event_id, p_amount, 'under_review', COALESCE(p_notes,'lot not found'));
    RETURN jsonb_build_object('status','under_review','reason','lot_not_found');
  END IF;

  v_consumed := v_lot.initial_amount - v_lot.remaining_amount;

  -- (a) Lote intacto → cancela lote, ajusta bids_balance (sem negativar)
  IF v_consumed = 0 THEN
    UPDATE public.bid_lots
       SET remaining_amount = 0,
           lot_status = CASE WHEN p_reversal_type='chargeback' THEN 'reversed' ELSE 'cancelled' END
     WHERE id = v_lot.id;
    UPDATE public.profiles
       SET bids_balance = GREATEST(0, COALESCE(bids_balance,0) - v_lot.initial_amount)
     WHERE id = v_lot.user_id;
  ELSE
    -- (b) Parcialmente consumido → NÃO altera bids históricos
    UPDATE public.bid_lots SET lot_status = 'disputed' WHERE id = v_lot.id;
  END IF;

  -- (c) Pontos já concedidos? Calcular o quanto é debitável sem negativar
  SELECT COALESCE(SUM(amount),0) INTO v_granted
    FROM public.points_ledger
   WHERE source_ref = v_lot.id::text AND kind='accrual';

  IF v_granted > 0 THEN
    SELECT * INTO v_wallet FROM public.points_wallets WHERE user_id = v_lot.user_id FOR UPDATE;
    IF v_wallet IS NULL THEN
      v_recover := 0;
    ELSE
      v_recover := LEAST(v_granted, COALESCE(v_wallet.available_points,0));
    END IF;
    v_outstand := v_granted - v_recover;

    -- Debita apenas o que é possível (append-only ledger + update wallet)
    IF v_recover > 0 THEN
      INSERT INTO public.points_ledger (user_id, kind, amount, source_ref, notes, metadata)
      VALUES (v_lot.user_id, 'reversal', -v_recover, v_lot.id::text,
              'estorno parcial recuperável de ' || p_reversal_type,
              jsonb_build_object('rule','no_negative_wallet','recovered',v_recover,'granted',v_granted));
      UPDATE public.points_wallets
         SET available_points = available_points - v_recover
       WHERE user_id = v_lot.user_id;
    END IF;

    -- Caso com saldo pendente
    v_case_stat := CASE
      WHEN v_outstand = 0            THEN 'RESOLVED'
      WHEN v_recover  > 0            THEN 'PARTIALLY_RECOVERED'
      ELSE 'UNDER_REVIEW'
    END;

    INSERT INTO public.points_reversal_cases
      (user_id, payment_id, bid_purchase_id, lot_id,
       points_to_reverse, points_recovered, points_outstanding,
       status, reason, metadata)
    VALUES
      (v_lot.user_id, v_lot.external_payment_id, p_bid_purchase_id, v_lot.id,
       v_granted, v_recover, v_outstand,
       v_case_stat, p_reversal_type,
       jsonb_build_object('gateway_event_id', p_gateway_event_id, 'notes', p_notes))
    RETURNING id INTO v_case_id;

    -- Bloqueia novos resgates enquanto houver caso não resolvido
    IF v_case_stat <> 'RESOLVED' THEN
      UPDATE public.points_wallets SET status='UNDER_REVIEW' WHERE user_id = v_lot.user_id;
    END IF;
  END IF;

  INSERT INTO public.payment_reversal_events
    (bid_lot_id, bid_purchase_id, reversal_case_id, reversal_type, gateway_event_id, amount, status, applied_at, notes)
  VALUES (v_lot.id, p_bid_purchase_id, v_case_id, p_reversal_type, p_gateway_event_id, p_amount,
          'applied', now(), p_notes);

  RETURN jsonb_build_object(
    'status', 'applied',
    'lot_id', v_lot.id,
    'consumed', v_consumed,
    'points_granted', v_granted,
    'points_recovered', v_recover,
    'points_outstanding', v_outstand,
    'case_id', v_case_id
  );
END $$;
REVOKE ALL ON FUNCTION public.reverse_paid_bid_purchase(uuid,text,text,numeric,text) FROM PUBLIC, anon, authenticated;

-- ─── 8. AUDITORIA de audience_mode / audience_version ──────────────────────
CREATE OR REPLACE FUNCTION public.points_audit_audience_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.key IN ('audience_mode','audience_version','pilot_audience') THEN
    INSERT INTO public.points_program_settings_audit (key, old_value, new_value, changed_by, changed_at)
    VALUES (NEW.key, to_jsonb(OLD.value), to_jsonb(NEW.value), COALESCE(NEW.updated_by, auth.uid()), now());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_points_audit_audience ON public.points_program_settings_json;
CREATE TRIGGER trg_points_audit_audience
  AFTER UPDATE ON public.points_program_settings_json
  FOR EACH ROW EXECUTE FUNCTION public.points_audit_audience_change();

-- ─── 9. ATIVAÇÃO ATÔMICA — points_admin_activate_pilot ─────────────────────
CREATE OR REPLACE FUNCTION public.points_admin_activate_pilot(
  p_rule_id              uuid,
  p_cutoff               timestamptz,
  p_pilot_user_ids       uuid[],
  p_audience_mode        text DEFAULT 'pilot'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_rule  record;
  v_flag  jsonb;
  v_new_ver integer;
BEGIN
  IF NOT public.points_is_admin(v_admin) THEN
    RAISE EXCEPTION 'apenas admin' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_audience_mode NOT IN ('pilot','all') THEN
    RAISE EXCEPTION 'audience_mode inválido' USING ERRCODE='invalid_parameter_value';
  END IF;
  IF p_cutoff IS NULL THEN
    RAISE EXCEPTION 'cutoff obrigatório' USING ERRCODE='invalid_parameter_value';
  END IF;

  -- 1) webhooks validados?
  SELECT value INTO v_flag FROM public.points_program_settings_json WHERE key='webhooks_validated';
  IF COALESCE((v_flag->>'validated')::boolean,false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ativação bloqueada: webhooks_validated=false' USING ERRCODE='check_violation';
  END IF;

  -- 2) regra existente e inativa
  SELECT * INTO v_rule FROM public.points_rules WHERE id = p_rule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'regra não existe' USING ERRCODE='no_data_found'; END IF;
  IF v_rule.is_active THEN RAISE EXCEPTION 'regra já ativa' USING ERRCODE='check_violation'; END IF;

  -- 3) audiência
  IF p_audience_mode='pilot' AND (p_pilot_user_ids IS NULL OR array_length(p_pilot_user_ids,1) IS NULL) THEN
    RAISE EXCEPTION 'pilot vazio' USING ERRCODE='check_violation';
  END IF;

  -- 4) ativa regra com o MESMO timestamp de corte
  UPDATE public.points_rules
     SET is_active = true, active_from = p_cutoff
   WHERE id = p_rule_id;

  -- 5) define ponto de corte
  INSERT INTO public.points_program_settings_time (key, value, is_admin_only)
  VALUES ('points_accrual_started_at', p_cutoff, true)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  -- 6) audiência + versão
  UPDATE public.points_program_settings_json
     SET value = jsonb_build_object('mode', p_audience_mode), updated_by = v_admin
   WHERE key = 'audience_mode';
  UPDATE public.points_program_settings_json
     SET value = jsonb_build_object('user_ids', to_jsonb(COALESCE(p_pilot_user_ids, ARRAY[]::uuid[]))),
         updated_by = v_admin
   WHERE key = 'pilot_audience';

  v_new_ver := public.points_audience_version() + 1;
  UPDATE public.points_program_settings_json
     SET value = jsonb_build_object('version', v_new_ver), updated_by = v_admin
   WHERE key = 'audience_version';

  -- 7) por fim, liga programa + acúmulo
  INSERT INTO public.points_program_settings_bool (key, value, is_admin_only)
  VALUES ('points_program_enabled', true, true),
         ('points_accrual_enabled', true, true)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  -- 8) auditoria
  INSERT INTO public.points_program_settings_audit (key, old_value, new_value, changed_by, changed_at)
  VALUES ('__activate_pilot__',
          to_jsonb(v_rule),
          jsonb_build_object('rule_id', p_rule_id, 'cutoff', p_cutoff,
                             'mode', p_audience_mode, 'audience_version', v_new_ver,
                             'pilot_size', COALESCE(array_length(p_pilot_user_ids,1),0)),
          v_admin, now());

  RETURN jsonb_build_object(
    'ok', true, 'rule_id', p_rule_id, 'cutoff', p_cutoff,
    'audience_mode', p_audience_mode, 'audience_version', v_new_ver
  );
END $$;
REVOKE ALL ON FUNCTION public.points_admin_activate_pilot(uuid,timestamptz,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.points_admin_activate_pilot(uuid,timestamptz,uuid[],text) TO authenticated;
-- (função valida is_admin internamente)

COMMIT;
