-- ============================================================================
-- PROGRAMA PONTOS SHOW — Fase 3 (BRANCH — NÃO APLICAR EM PRODUÇÃO)
-- Regra versionada + corte por data de pagamento + idempotência + RPC canônica
-- + audiência explícita + estorno/chargeback.
--
-- Segurança operacional:
--   * Idempotente (IF NOT EXISTS / OR REPLACE em tudo).
--   * Sem backfill de dados.
--   * Sem alteração de flags existentes.
--   * Não define points_accrual_started_at.
--   * audience_mode nasce em 'off'.
-- ============================================================================

BEGIN;

-- ─── 1. REGRA CANÔNICA VERSIONADA ───────────────────────────────────────────
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

-- Apenas uma versão ATIVA por rule_code
CREATE UNIQUE INDEX IF NOT EXISTS points_rules_one_active_per_code
  ON public.points_rules (rule_code) WHERE is_active;

-- Imutabilidade quando já houver bids vinculados
CREATE OR REPLACE FUNCTION public.points_rules_prevent_material_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_bids boolean;
BEGIN
  IF (NEW.bids_per_point,   NEW.points_per_block, NEW.multiplier, NEW.rule_code, NEW.version)
   IS DISTINCT FROM
     (OLD.bids_per_point,   OLD.points_per_block, OLD.multiplier, OLD.rule_code, OLD.version)
  THEN
    SELECT EXISTS (SELECT 1 FROM public.bids WHERE points_rule_id = OLD.id) INTO has_bids;
    IF has_bids THEN
      RAISE EXCEPTION 'points_rules % v% is immutable: bids already reference it', OLD.rule_code, OLD.version
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_points_rules_immutable ON public.points_rules;
CREATE TRIGGER trg_points_rules_immutable
  BEFORE UPDATE ON public.points_rules
  FOR EACH ROW EXECUTE FUNCTION public.points_rules_prevent_material_update();

-- Regra semente 12:1 — INATIVA
INSERT INTO public.points_rules (rule_code, version, bids_per_point, points_per_block, multiplier, is_active, metadata)
VALUES ('POINTS_STANDARD', 1, 12, 1, 1, false,
        jsonb_build_object('seeded_by_migration','points-phase3','notes','regra canônica inicial, nasce inativa'))
ON CONFLICT (rule_code, version) DO NOTHING;

-- Coluna de vínculo em bids (nullable — só bids elegíveis carregam)
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS points_rule_id uuid NULL REFERENCES public.points_rules(id);

-- ─── 2. CORTE POR DATA DE PAGAMENTO ─────────────────────────────────────────
ALTER TABLE public.bid_lots
  ADD COLUMN IF NOT EXISTS payment_environment  text NULL,
  ADD COLUMN IF NOT EXISTS payment_gateway      text NULL,
  ADD COLUMN IF NOT EXISTS gateway_account_id   text NULL,
  ADD COLUMN IF NOT EXISTS external_payment_id  text NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key      text NULL,
  ADD COLUMN IF NOT EXISTS bid_purchase_id      uuid NULL,
  ADD COLUMN IF NOT EXISTS payment_created_at   timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS webhook_received_at  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS credited_via_canonical_rpc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lot_status text NOT NULL DEFAULT 'active'
    CHECK (lot_status IN ('active','disputed','reversed','cancelled'));

-- ─── 3. IDEMPOTÊNCIA CANÔNICA ───────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS bid_lots_idempotency_key_uidx
  ON public.bid_lots (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bid_lots_payment_ident_uidx
  ON public.bid_lots (payment_environment, payment_gateway, gateway_account_id, external_payment_id)
  WHERE payment_environment IS NOT NULL
    AND payment_gateway     IS NOT NULL
    AND external_payment_id IS NOT NULL;

-- ─── 5. AUDIÊNCIA EXPLÍCITA ─────────────────────────────────────────────────
-- audience_mode em points_program_settings_json para permitir modo+meta
INSERT INTO public.points_program_settings_json (key, value, is_admin_only)
VALUES ('audience_mode',    jsonb_build_object('mode','off'), true),
       ('audience_version', jsonb_build_object('version', 1), true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.points_audience_mode()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((value->>'mode'), 'off')
  FROM public.points_program_settings_json WHERE key = 'audience_mode';
$$;
REVOKE ALL ON FUNCTION public.points_audience_mode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.points_audience_mode() TO service_role, authenticated;

-- ─── 4. RPC CANÔNICA credit_paid_bid_purchase ───────────────────────────────
-- Privada: SECURITY DEFINER, sem GRANT EXECUTE para anon/authenticated.
-- Somente service_role (usada pelos webhooks) pode invocar.
CREATE OR REPLACE FUNCTION public.credit_paid_bid_purchase(
  p_user_id              uuid,
  p_bid_purchase_id      uuid,
  p_bids_amount          integer,
  p_amount_paid          numeric,
  p_payment_environment  text,
  p_payment_gateway      text,
  p_gateway_account_id   text,
  p_external_payment_id  text,
  p_payment_created_at   timestamptz,
  p_payment_confirmed_at timestamptz,
  p_webhook_received_at  timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key       bigint;
  v_purchase       record;
  v_idem           text;
  v_existing_lot   uuid;
  v_new_lot_id     uuid;
  v_cutoff         timestamptz;
  v_eligible       boolean := false;
  v_active_rule_id uuid;
  v_audience_mode  text;
BEGIN
  IF p_user_id IS NULL OR p_bid_purchase_id IS NULL OR p_bids_amount IS NULL OR p_bids_amount <= 0 THEN
    RAISE EXCEPTION 'credit_paid_bid_purchase: invalid arguments' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_payment_environment IS NULL OR p_payment_gateway IS NULL OR p_external_payment_id IS NULL THEN
    RAISE EXCEPTION 'credit_paid_bid_purchase: payment identity is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_idem := 'lot:' || p_payment_environment || ':' || p_payment_gateway || ':'
         || COALESCE(p_gateway_account_id,'-') || ':' || p_external_payment_id;

  -- 1) Idempotência FIRST: se lote existe, retorna sem side-effect
  SELECT id INTO v_existing_lot FROM public.bid_lots WHERE idempotency_key = v_idem LIMIT 1;
  IF v_existing_lot IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'lot_id', v_existing_lot, 'reason', 'already_credited');
  END IF;

  -- 2) Lock advisory por bid_purchase (evita corrida entre webhooks duplicados)
  v_lock_key := ('x' || substr(md5(p_bid_purchase_id::text),1,15))::bit(60)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 3) Bloqueia a compra e revalida estado
  SELECT * INTO v_purchase FROM public.bid_purchases WHERE id = p_bid_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bid_purchase % not found', p_bid_purchase_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_purchase.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'user_id mismatch for bid_purchase %', p_bid_purchase_id USING ERRCODE = 'check_violation';
  END IF;
  IF v_purchase.bids_purchased IS DISTINCT FROM p_bids_amount THEN
    RAISE EXCEPTION 'bids_amount mismatch (expected %, got %)', v_purchase.bids_purchased, p_bids_amount USING ERRCODE = 'check_violation';
  END IF;

  -- Recheca idempotência dentro do lock
  SELECT id INTO v_existing_lot FROM public.bid_lots WHERE idempotency_key = v_idem LIMIT 1;
  IF v_existing_lot IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'lot_id', v_existing_lot, 'reason', 'already_credited_race');
  END IF;

  -- 4) Elegibilidade: audiência + corte + regra ativa
  SELECT public.points_audience_mode() INTO v_audience_mode;
  SELECT value INTO v_cutoff FROM public.points_program_settings_time WHERE key='points_accrual_started_at';
  SELECT id INTO v_active_rule_id
    FROM public.points_rules
    WHERE rule_code='POINTS_STANDARD' AND is_active = true
    LIMIT 1;

  v_eligible := (
    v_audience_mode <> 'off'
    AND v_cutoff IS NOT NULL
    AND p_payment_confirmed_at IS NOT NULL
    AND p_payment_confirmed_at >= v_cutoff
    AND v_active_rule_id IS NOT NULL
    AND COALESCE(v_purchase.payment_status,'') = 'completed'
  );

  -- 5) Insere lote canônico (unique constraints garantem não-duplicação)
  INSERT INTO public.bid_lots (
    user_id, source, initial_amount, remaining_amount,
    bid_purchase_id, payment_environment, payment_gateway, gateway_account_id,
    external_payment_id, idempotency_key,
    payment_created_at, payment_confirmed_at, webhook_received_at,
    eligible_for_points, points_rule_id_snapshot,
    credited_via_canonical_rpc, lot_status
  ) VALUES (
    p_user_id, 'paid_purchase', p_bids_amount, p_bids_amount,
    p_bid_purchase_id, p_payment_environment, p_payment_gateway, p_gateway_account_id,
    p_external_payment_id, v_idem,
    p_payment_created_at, p_payment_confirmed_at, p_webhook_received_at,
    v_eligible, CASE WHEN v_eligible THEN v_active_rule_id ELSE NULL END,
    true, 'active'
  )
  RETURNING id INTO v_new_lot_id;

  -- 6) Marca a compra como creditada canonicamente (bloqueia lote 'unknown' do trigger)
  UPDATE public.bid_purchases
     SET credited_via_canonical_rpc = true,
         canonical_lot_id           = v_new_lot_id
   WHERE id = p_bid_purchase_id;

  RETURN jsonb_build_object(
    'idempotent', false,
    'lot_id', v_new_lot_id,
    'eligible_for_points', v_eligible,
    'audience_mode', v_audience_mode
  );
END $$;

REVOKE ALL ON FUNCTION public.credit_paid_bid_purchase(uuid,uuid,integer,numeric,text,text,text,text,timestamptz,timestamptz,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_paid_bid_purchase(uuid,uuid,integer,numeric,text,text,text,text,timestamptz,timestamptz,timestamptz) FROM anon, authenticated;
-- service_role bypassa RLS/GRANTs; não é necessário GRANT explícito.

-- Colunas de suporte ao marcador
ALTER TABLE public.bid_purchases
  ADD COLUMN IF NOT EXISTS credited_via_canonical_rpc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canonical_lot_id uuid NULL REFERENCES public.bid_lots(id);

ALTER TABLE public.bid_lots
  ADD COLUMN IF NOT EXISTS points_rule_id_snapshot uuid NULL REFERENCES public.points_rules(id);

-- ─── 4b. AJUSTE DO trg_sync_bid_lots (unificação do criador) ────────────────
-- Se o gatilho legado cria lotes 'unknown' a partir de profiles.bids_balance,
-- impede-se essa criação quando a compra correspondente já tiver sido creditada
-- pela RPC canônica. A lógica exata do trigger permanece em produção; aqui
-- adicionamos um GUARD que qualquer versão futura do trigger deve respeitar.
CREATE OR REPLACE FUNCTION public.points_should_skip_unknown_lot(p_user_id uuid, p_delta integer)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Se existe compra confirmada recente cuja bids_purchased == p_delta e já
  -- foi creditada canonicamente, o lote 'unknown' NÃO deve ser criado.
  RETURN EXISTS (
    SELECT 1 FROM public.bid_purchases
     WHERE user_id = p_user_id
       AND bids_purchased = p_delta
       AND credited_via_canonical_rpc = true
       AND updated_at > now() - interval '10 minutes'
  );
END $$;
REVOKE ALL ON FUNCTION public.points_should_skip_unknown_lot(uuid,integer) FROM PUBLIC;

-- ─── 6. ESTORNO / CHARGEBACK ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_reversal_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_lot_id            uuid NULL REFERENCES public.bid_lots(id),
  bid_purchase_id       uuid NULL REFERENCES public.bid_purchases(id),
  reversal_type         text NOT NULL CHECK (reversal_type IN ('cancelled','refunded','chargeback','partial_refund','duplicate')),
  gateway_event_id      text NULL,
  amount                numeric NULL,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','under_review','rejected')),
  notes                 text NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  applied_at            timestamptz NULL
);
GRANT ALL ON public.payment_reversal_events TO service_role;
ALTER TABLE public.payment_reversal_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_reversal_events' AND policyname='admin read reversals') THEN
    CREATE POLICY "admin read reversals" ON public.payment_reversal_events FOR SELECT TO authenticated
      USING (public.is_admin_user(auth.uid()));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payment_reversal_events_gateway_uidx
  ON public.payment_reversal_events (gateway_event_id) WHERE gateway_event_id IS NOT NULL;

-- RPC de reversão (privada) — aplica regras A/B/C/D do briefing
CREATE OR REPLACE FUNCTION public.reverse_paid_bid_purchase(
  p_bid_purchase_id uuid,
  p_reversal_type   text,
  p_gateway_event_id text,
  p_amount          numeric DEFAULT NULL,
  p_notes           text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lot          record;
  v_consumed     integer;
  v_wallet_row   record;
  v_result_status text := 'applied';
BEGIN
  IF p_reversal_type NOT IN ('cancelled','refunded','chargeback','partial_refund','duplicate') THEN
    RAISE EXCEPTION 'invalid reversal_type %', p_reversal_type USING ERRCODE='invalid_parameter_value';
  END IF;

  -- Idempotência por gateway_event_id
  IF p_gateway_event_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.payment_reversal_events WHERE gateway_event_id = p_gateway_event_id) THEN
    RETURN jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO v_lot FROM public.bid_lots
    WHERE bid_purchase_id = p_bid_purchase_id
      AND credited_via_canonical_rpc = true
    ORDER BY created_at DESC LIMIT 1
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payment_reversal_events (bid_purchase_id, reversal_type, gateway_event_id, amount, status, notes)
    VALUES (p_bid_purchase_id, p_reversal_type, p_gateway_event_id, p_amount, 'under_review', COALESCE(p_notes,'lot not found'));
    RETURN jsonb_build_object('status','under_review','reason','lot_not_found');
  END IF;

  v_consumed := v_lot.initial_amount - v_lot.remaining_amount;

  IF v_consumed = 0 THEN
    -- A) Lote intacto: cancelar lote e ajustar bids_balance
    UPDATE public.bid_lots
       SET remaining_amount = 0, lot_status = CASE WHEN p_reversal_type='chargeback' THEN 'reversed' ELSE 'cancelled' END
     WHERE id = v_lot.id;

    UPDATE public.profiles
       SET bids_balance = GREATEST(0, COALESCE(bids_balance,0) - v_lot.initial_amount)
     WHERE id = v_lot.user_id;

    v_result_status := 'applied';
  ELSE
    -- B) Parcialmente utilizado: NÃO altera bids históricos. Marca disputa.
    UPDATE public.bid_lots SET lot_status = 'disputed' WHERE id = v_lot.id;
    v_result_status := 'under_review';
  END IF;

  -- C/D) Compensação de pontos, se já concedidos
  IF v_lot.eligible_for_points THEN
    -- Se houve settlement, cria lançamento negativo (append-only)
    IF EXISTS (SELECT 1 FROM public.points_ledger WHERE source_ref = v_lot.id::text AND kind='accrual') THEN
      INSERT INTO public.points_ledger (user_id, kind, amount, source_ref, notes)
        SELECT user_id, 'reversal', -SUM(amount), v_lot.id::text,
               'compensação por ' || p_reversal_type
          FROM public.points_ledger
         WHERE source_ref = v_lot.id::text AND kind='accrual'
         GROUP BY user_id;

      -- Wallet pode ficar negativa: colocar em UNDER_REVIEW se necessário
      SELECT * INTO v_wallet_row FROM public.points_wallets WHERE user_id = v_lot.user_id FOR UPDATE;
      IF v_wallet_row IS NOT NULL AND v_wallet_row.balance < 0 THEN
        UPDATE public.points_wallets SET status='UNDER_REVIEW' WHERE user_id = v_lot.user_id;
        v_result_status := 'under_review';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.payment_reversal_events
    (bid_lot_id, bid_purchase_id, reversal_type, gateway_event_id, amount, status, applied_at, notes)
  VALUES (v_lot.id, p_bid_purchase_id, p_reversal_type, p_gateway_event_id, p_amount,
          v_result_status, CASE WHEN v_result_status='applied' THEN now() END, p_notes);

  RETURN jsonb_build_object('status', v_result_status, 'lot_id', v_lot.id, 'consumed', v_consumed);
END $$;
REVOKE ALL ON FUNCTION public.reverse_paid_bid_purchase(uuid,text,text,numeric,text) FROM PUBLIC, anon, authenticated;

-- ─── 7. AUDITORIA DE audience_mode ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.points_audit_audience_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.key IN ('audience_mode','audience_version') THEN
    INSERT INTO public.points_program_settings_audit (key, old_value, new_value, changed_by, changed_at)
    VALUES (NEW.key, to_jsonb(OLD.value), to_jsonb(NEW.value), NEW.updated_by, now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_points_audit_audience ON public.points_program_settings_json;
CREATE TRIGGER trg_points_audit_audience
  AFTER UPDATE ON public.points_program_settings_json
  FOR EACH ROW EXECUTE FUNCTION public.points_audit_audience_change();

COMMIT;
