-- ============================================================================
-- PROGRAMA PONTOS SHOW — Fase 1 v3
-- ============================================================================

-- ─── 1. TABELAS DE CONFIGURAÇÃO (KV TIPADO) ─────────────────────────────────

CREATE TABLE public.points_program_settings_bool (
  key           text PRIMARY KEY,
  value         boolean NOT NULL,
  is_admin_only boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid NULL
);
GRANT SELECT ON public.points_program_settings_bool TO authenticated;
GRANT ALL    ON public.points_program_settings_bool TO service_role;
ALTER TABLE public.points_program_settings_bool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read non-admin bool settings"
  ON public.points_program_settings_bool FOR SELECT TO authenticated
  USING (is_admin_only = false OR public.is_admin_user(auth.uid()));

CREATE TABLE public.points_program_settings_num (
  key           text PRIMARY KEY,
  value         numeric NOT NULL,
  is_admin_only boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid NULL
);
GRANT SELECT ON public.points_program_settings_num TO authenticated;
GRANT ALL    ON public.points_program_settings_num TO service_role;
ALTER TABLE public.points_program_settings_num ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read non-admin num settings"
  ON public.points_program_settings_num FOR SELECT TO authenticated
  USING (is_admin_only = false OR public.is_admin_user(auth.uid()));

CREATE TABLE public.points_program_settings_time (
  key           text PRIMARY KEY,
  value         timestamptz NULL,
  is_admin_only boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid NULL
);
GRANT SELECT ON public.points_program_settings_time TO authenticated;
GRANT ALL    ON public.points_program_settings_time TO service_role;
ALTER TABLE public.points_program_settings_time ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read non-admin time settings"
  ON public.points_program_settings_time FOR SELECT TO authenticated
  USING (is_admin_only = false OR public.is_admin_user(auth.uid()));

CREATE TABLE public.points_program_settings_json (
  key           text PRIMARY KEY,
  value         jsonb NOT NULL,
  is_admin_only boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid NULL
);
GRANT SELECT ON public.points_program_settings_json TO authenticated;
GRANT ALL    ON public.points_program_settings_json TO service_role;
ALTER TABLE public.points_program_settings_json ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read non-admin json settings"
  ON public.points_program_settings_json FOR SELECT TO authenticated
  USING (is_admin_only = false OR public.is_admin_user(auth.uid()));

CREATE TABLE public.points_program_settings_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL,
  table_type  text NOT NULL CHECK (table_type IN ('bool','num','time','json')),
  old_value   text NULL,
  new_value   text NULL,
  actor       uuid NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_program_settings_audit TO authenticated;
GRANT ALL    ON public.points_program_settings_audit TO service_role;
ALTER TABLE public.points_program_settings_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads audit"
  ON public.points_program_settings_audit FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- ─── 2. SEED DE FLAGS ───────────────────────────────────────────────────────

INSERT INTO public.points_program_settings_bool(key,value,is_admin_only) VALUES
  ('points_program_enabled',          false, false),
  ('points_accrual_enabled',          false, false),
  ('points_lot_consumption_enabled',  false, true),
  ('points_store_enabled',            false, false),
  ('points_redemption_enabled',       false, false),
  ('points_campaigns_enabled',        false, true),
  ('webhooks_validated',              false, true),
  ('audience_configured',             false, true);

INSERT INTO public.points_program_settings_num(key,value,is_admin_only) VALUES
  ('points_bids_per_point', 12, false);

INSERT INTO public.points_program_settings_time(key,value,is_admin_only) VALUES
  ('points_accrual_started_at', NULL, false),
  ('points_program_started_at', NULL, false);

INSERT INTO public.points_program_settings_json(key,value,is_admin_only) VALUES
  ('points_consumption_priority', '["eligible_paid","legacy"]'::jsonb, true),
  ('points_eligible_sources',     '["paid_purchase"]'::jsonb,          true),
  ('points_eligible_auctions',    '"all"'::jsonb,                       true),
  ('points_pilot_users',          '[]'::jsonb,                          true),
  ('points_campaigns',            '[]'::jsonb,                          true);

-- ─── 3. HELPERS DE LEITURA ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.points_get_bool(p_key text, p_default boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT value FROM points_program_settings_bool WHERE key=p_key), p_default);
$$;
CREATE OR REPLACE FUNCTION public.points_get_num(p_key text, p_default numeric DEFAULT 0)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT value FROM points_program_settings_num WHERE key=p_key), p_default);
$$;
CREATE OR REPLACE FUNCTION public.points_get_time(p_key text)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT value FROM points_program_settings_time WHERE key=p_key;
$$;
CREATE OR REPLACE FUNCTION public.points_get_json(p_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT value FROM points_program_settings_json WHERE key=p_key;
$$;

GRANT EXECUTE ON FUNCTION public.points_get_bool(text,boolean)  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.points_get_num(text,numeric)   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.points_get_time(text)          TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.points_get_json(text)          TO authenticated, anon;

-- ─── 4. RPCs ADMIN DE ESCRITA ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.points_admin_set_bool(p_key text, p_value boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old text;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT value::text INTO v_old FROM points_program_settings_bool WHERE key=p_key;
  UPDATE points_program_settings_bool
    SET value=p_value, updated_at=now(), updated_by=auth.uid() WHERE key=p_key;
  INSERT INTO points_program_settings_audit(key,table_type,old_value,new_value,actor)
    VALUES (p_key,'bool',v_old,p_value::text,auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.points_admin_set_num(p_key text, p_value numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old text;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT value::text INTO v_old FROM points_program_settings_num WHERE key=p_key;
  UPDATE points_program_settings_num
    SET value=p_value, updated_at=now(), updated_by=auth.uid() WHERE key=p_key;
  INSERT INTO points_program_settings_audit(key,table_type,old_value,new_value,actor)
    VALUES (p_key,'num',v_old,p_value::text,auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.points_admin_set_time(p_key text, p_value timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old text;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT value::text INTO v_old FROM points_program_settings_time WHERE key=p_key;
  UPDATE points_program_settings_time
    SET value=p_value, updated_at=now(), updated_by=auth.uid() WHERE key=p_key;
  INSERT INTO points_program_settings_audit(key,table_type,old_value,new_value,actor)
    VALUES (p_key,'time',v_old,p_value::text,auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.points_admin_set_json(p_key text, p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old text;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT value::text INTO v_old FROM points_program_settings_json WHERE key=p_key;
  UPDATE points_program_settings_json
    SET value=p_value, updated_at=now(), updated_by=auth.uid() WHERE key=p_key;
  INSERT INTO points_program_settings_audit(key,table_type,old_value,new_value,actor)
    VALUES (p_key,'json',v_old,p_value::text,auth.uid());
END $$;

REVOKE ALL ON FUNCTION public.points_admin_set_bool(text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.points_admin_set_num(text,numeric)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.points_admin_set_time(text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.points_admin_set_json(text,jsonb)   FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.points_admin_set_bool(text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.points_admin_set_num(text,numeric)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.points_admin_set_time(text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.points_admin_set_json(text,jsonb)   TO authenticated;

-- ─── 5. COLUNAS ADITIVAS ────────────────────────────────────────────────────

ALTER TABLE public.bid_lots
  ADD COLUMN eligible_for_points boolean NOT NULL DEFAULT false,
  ADD COLUMN payment_gateway     text    NULL,
  ADD COLUMN external_payment_id text    NULL,
  ADD COLUMN bid_purchase_id     uuid    NULL,
  ADD COLUMN purchased_at        timestamptz NULL,
  ADD COLUMN idempotency_key     text    NULL;

CREATE UNIQUE INDEX bid_lots_gateway_extid_uk
  ON public.bid_lots(payment_gateway, external_payment_id)
  WHERE payment_gateway IS NOT NULL AND external_payment_id IS NOT NULL;
CREATE UNIQUE INDEX bid_lots_idempotency_uk
  ON public.bid_lots(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX bid_lots_eligible_fifo_ix
  ON public.bid_lots(user_id, purchased_at)
  WHERE eligible_for_points = true AND remaining_amount > 0;

ALTER TABLE public.bids
  ADD COLUMN source                          text    NULL,
  ADD COLUMN lot_id                          uuid    NULL REFERENCES public.bid_lots(id),
  ADD COLUMN eligible_for_points             boolean NOT NULL DEFAULT false,
  ADD COLUMN is_test                         boolean NOT NULL DEFAULT false,
  ADD COLUMN points_rule_id                  uuid    NULL,
  ADD COLUMN points_campaign_id              uuid    NULL,
  ADD COLUMN points_multiplier_snapshot      numeric NULL,
  ADD COLUMN audience_version_snapshot       int     NULL,
  ADD COLUMN points_program_active_at_bid    boolean NULL,
  ADD COLUMN points_accrual_active_at_bid    boolean NULL,
  ADD COLUMN accrual_started_at_snapshot     timestamptz NULL,
  ADD COLUMN tracking_status                 text    NOT NULL DEFAULT 'pre_cutoff'
    CHECK (tracking_status IN ('pre_cutoff','tracked','legacy'));

ALTER TABLE public.profiles
  ADD COLUMN is_test_account boolean NOT NULL DEFAULT false;

-- ─── 6. TABELAS DE SUPORTE ──────────────────────────────────────────────────

CREATE TABLE public.bid_lot_consumptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id              uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  lot_id              uuid NOT NULL REFERENCES public.bid_lots(id),
  amount_consumed     numeric NOT NULL CHECK (amount_consumed > 0),
  source              text NULL,
  eligible_for_points boolean NOT NULL,
  bid_purchase_id     uuid NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bid_lot_consumptions_bid_ix ON public.bid_lot_consumptions(bid_id);
CREATE INDEX bid_lot_consumptions_lot_ix ON public.bid_lot_consumptions(lot_id);
GRANT SELECT ON public.bid_lot_consumptions TO authenticated;
GRANT ALL    ON public.bid_lot_consumptions TO service_role;
ALTER TABLE public.bid_lot_consumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own consumptions"
  ON public.bid_lot_consumptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_lot_consumptions.bid_id AND b.user_id = auth.uid()));
CREATE POLICY "admin reads all consumptions"
  ON public.bid_lot_consumptions FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE TABLE public.points_bid_reconciliation_queue (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id            uuid NULL REFERENCES public.bids(id) ON DELETE SET NULL,
  user_id           uuid NOT NULL,
  reason            text NOT NULL,
  requested_amount  numeric NOT NULL,
  available_amount  numeric NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_bid_reconciliation_queue TO authenticated;
GRANT ALL    ON public.points_bid_reconciliation_queue TO service_role;
ALTER TABLE public.points_bid_reconciliation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads reconciliation"
  ON public.points_bid_reconciliation_queue FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- ─── 7. FUNÇÕES DE CONSUMO DE LOTES ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.preview_consume_bid_lots(
  p_user_id uuid, p_amount numeric
) RETURNS TABLE(lot_id uuid, take numeric, eligible boolean, source text, bid_purchase_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cutoff timestamptz := public.points_get_time('points_accrual_started_at');
  v_prio jsonb := public.points_get_json('points_consumption_priority');
  v_remaining numeric := p_amount;
  r RECORD;
BEGIN
  IF (v_prio->>0) = 'eligible_paid' AND v_cutoff IS NOT NULL THEN
    FOR r IN
      SELECT id, remaining_amount, source AS src, bid_purchase_id AS bpi
      FROM public.bid_lots
      WHERE user_id=p_user_id
        AND remaining_amount > 0
        AND eligible_for_points = true
        AND purchased_at IS NOT NULL AND purchased_at > v_cutoff
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY purchased_at ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      lot_id := r.id; take := LEAST(r.remaining_amount, v_remaining);
      eligible := true; source := r.src; bid_purchase_id := r.bpi;
      v_remaining := v_remaining - take; RETURN NEXT;
    END LOOP;
  END IF;

  IF v_remaining > 0 THEN
    FOR r IN
      SELECT id, remaining_amount, source AS src, bid_purchase_id AS bpi
      FROM public.bid_lots
      WHERE user_id=p_user_id
        AND remaining_amount > 0
        AND (
          eligible_for_points = false
          OR purchased_at IS NULL
          OR v_cutoff IS NULL
          OR purchased_at <= v_cutoff
        )
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY COALESCE(purchased_at, created_at) ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      lot_id := r.id; take := LEAST(r.remaining_amount, v_remaining);
      eligible := false; source := r.src; bid_purchase_id := r.bpi;
      v_remaining := v_remaining - take; RETURN NEXT;
    END LOOP;
  END IF;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'insufficient_lot_balance' USING ERRCODE='P0001';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.commit_bid_lot_consumptions(
  p_bid_id uuid, p_rows json
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM json_to_recordset(p_rows) AS x(
    lot_id uuid, take numeric, eligible boolean, source text, bid_purchase_id uuid
  ) LOOP
    UPDATE public.bid_lots
      SET remaining_amount = remaining_amount - r.take,
          updated_at = now()
      WHERE id = r.lot_id AND remaining_amount >= r.take;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lot_race_condition' USING ERRCODE='40001';
    END IF;
    INSERT INTO public.bid_lot_consumptions(
      bid_id, lot_id, amount_consumed, source, eligible_for_points, bid_purchase_id
    ) VALUES (p_bid_id, r.lot_id, r.take, r.source, r.eligible, r.bid_purchase_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.consume_bid_lots_for_bid(
  p_user_id uuid, p_amount numeric, p_bid_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_rows json;
  v_all_eligible boolean;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO v_rows FROM (
    SELECT * FROM public.preview_consume_bid_lots(p_user_id, p_amount)
  ) t;
  IF v_rows IS NULL THEN
    RAISE EXCEPTION 'insufficient_lot_balance';
  END IF;
  SELECT bool_and((r->>'eligible')::boolean) INTO v_all_eligible
    FROM json_array_elements(v_rows) r;
  PERFORM public.commit_bid_lot_consumptions(p_bid_id, v_rows);
  RETURN COALESCE(v_all_eligible, false);
END $$;

REVOKE ALL ON FUNCTION public.preview_consume_bid_lots(uuid,numeric)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_bid_lot_consumptions(uuid,json)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_bid_lots_for_bid(uuid,numeric,uuid)  FROM PUBLIC;

-- ─── 8. place_bid — versão aditiva ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_bid(p_auction_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE
  v_balance                numeric;
  v_bid_id                 uuid;
  v_program_on             boolean := public.points_get_bool('points_program_enabled', false);
  v_accrual_on             boolean := public.points_get_bool('points_accrual_enabled', false);
  v_consumption_on         boolean := public.points_get_bool('points_lot_consumption_enabled', false);
  v_started_at             timestamptz := public.points_get_time('points_accrual_started_at');
  v_pilot                  jsonb   := public.points_get_json('points_pilot_users');
  v_is_bot                 boolean := false;
  v_is_admin               boolean := false;
  v_is_test                boolean := false;
  v_in_pilot               boolean := false;
  v_accrual_active_snap    boolean;
  v_tracking               text;
  v_eligible               boolean := false;
  v_source                 text := NULL;
  v_lot_id                 uuid := NULL;
  v_rows                   json := NULL;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT bids_balance, COALESCE(is_bot,false), COALESCE(is_admin,false), COALESCE(is_test_account,false)
    INTO v_balance, v_is_bot, v_is_admin, v_is_test
    FROM profiles WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 1 THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  v_in_pilot := (v_pilot ? p_user_id::text);

  v_accrual_active_snap := v_consumption_on
                          AND v_started_at IS NOT NULL
                          AND now() > v_started_at;
  v_tracking := CASE WHEN v_accrual_active_snap THEN 'tracked' ELSE 'pre_cutoff' END;

  IF v_consumption_on THEN
    BEGIN
      SELECT json_agg(row_to_json(t)) INTO v_rows FROM (
        SELECT * FROM public.preview_consume_bid_lots(p_user_id, 1)
      ) t;
      IF v_rows IS NOT NULL THEN
        SELECT bool_and((r->>'eligible')::boolean),
               (v_rows->0->>'source'),
               ((v_rows->0->>'lot_id')::uuid)
          INTO v_eligible, v_source, v_lot_id
          FROM json_array_elements(v_rows) r;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.points_bid_reconciliation_queue(user_id, reason, requested_amount)
        VALUES (p_user_id, SQLERRM, 1);
      v_rows := NULL;
      v_eligible := false;
    END;
  END IF;

  IF v_is_bot OR v_is_admin OR v_is_test OR NOT v_in_pilot OR NOT v_accrual_active_snap THEN
    v_eligible := false;
  END IF;

  PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
  UPDATE profiles SET bids_balance = bids_balance - 1 WHERE user_id = p_user_id;
  PERFORM set_config('app.allow_sensitive_profile_update', '', true);

  INSERT INTO bids(
    auction_id, user_id, bid_amount, cost_paid,
    source, lot_id, eligible_for_points, is_test,
    points_program_active_at_bid, points_accrual_active_at_bid,
    accrual_started_at_snapshot, tracking_status
  ) VALUES (
    p_auction_id, p_user_id, 1, 1.00,
    v_source, v_lot_id, v_eligible, v_is_test,
    v_program_on, v_accrual_active_snap,
    v_started_at, v_tracking
  ) RETURNING id INTO v_bid_id;

  IF v_rows IS NOT NULL THEN
    PERFORM public.commit_bid_lot_consumptions(v_bid_id, v_rows);
  END IF;
END;
$function$;

-- ─── 9. place_bid_as (service_role) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_bid_as(
  p_actor uuid, p_target uuid, p_auction uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: service_role only';
  END IF;
  PERFORM public.place_bid(p_auction, p_target);
  PERFORM p_actor;
END $$;
REVOKE ALL ON FUNCTION public.place_bid_as(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bid_as(uuid,uuid,uuid) TO service_role;