-- =====================================================================
-- Fase 2A — Fundação de Pontuação
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.points_wallet_status AS ENUM
    ('NORMAL','UNDER_REVIEW','BLOCKED','SUSPENDED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.points_ledger_type AS ENUM (
    'EARN_AUCTION','EARN_CAMPAIGN',
    'RESERVE_REDEMPTION','CONFIRM_REDEMPTION','RELEASE_REDEMPTION',
    'ADMIN_CREDIT','ADMIN_DEBIT',
    'ORDER_REVERSAL','CHARGEBACK_REVERSAL','FRAUD_REVERSAL',
    'EXPIRATION','CORRECTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.points_settlement_status AS ENUM
    ('PENDING','PROCESSING','COMPLETED','FAILED','REVERSED','SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.points_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  bids_per_point  integer NOT NULL CHECK (bids_per_point > 0),
  multiplier      numeric(10,4) NOT NULL DEFAULT 1 CHECK (multiplier > 0),
  campaign_id     uuid,
  active_from     timestamptz NOT NULL DEFAULT now(),
  active_to       timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_rules TO authenticated;
GRANT ALL    ON public.points_rules TO service_role;
ALTER TABLE public.points_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_rules_admin_all" ON public.points_rules
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
CREATE POLICY "points_rules_read_active" ON public.points_rules
  FOR SELECT TO authenticated USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.points_wallets (
  user_id           uuid PRIMARY KEY,
  available_points  bigint NOT NULL DEFAULT 0,
  reserved_points   bigint NOT NULL DEFAULT 0,
  blocked_points    bigint NOT NULL DEFAULT 0,
  expired_points    bigint NOT NULL DEFAULT 0,
  lifetime_earned   bigint NOT NULL DEFAULT 0,
  lifetime_redeemed bigint NOT NULL DEFAULT 0,
  lifetime_reversed bigint NOT NULL DEFAULT 0,
  status            public.points_wallet_status NOT NULL DEFAULT 'NORMAL',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT points_wallets_available_nonneg CHECK (available_points >= 0),
  CONSTRAINT points_wallets_reserved_nonneg  CHECK (reserved_points  >= 0),
  CONSTRAINT points_wallets_blocked_nonneg   CHECK (blocked_points   >= 0),
  CONSTRAINT points_wallets_expired_nonneg   CHECK (expired_points   >= 0)
);
GRANT SELECT ON public.points_wallets TO authenticated;
GRANT ALL    ON public.points_wallets TO service_role;
ALTER TABLE public.points_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_self_read" ON public.points_wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));
CREATE POLICY "wallets_admin_write" ON public.points_wallets
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.points_ledger (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  transaction_type  public.points_ledger_type NOT NULL,
  points_delta      bigint NOT NULL,
  available_before  bigint NOT NULL,
  available_after   bigint NOT NULL,
  reserved_before   bigint NOT NULL,
  reserved_after    bigint NOT NULL,
  auction_id        uuid,
  settlement_id     uuid,
  redemption_id     uuid,
  payment_id        uuid,
  rule_id           uuid REFERENCES public.points_rules(id),
  campaign_id       uuid,
  admin_id          uuid,
  reason            text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key   text UNIQUE,
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON public.points_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_ledger_settlement ON public.points_ledger(settlement_id);
GRANT SELECT ON public.points_ledger TO authenticated;
GRANT ALL    ON public.points_ledger TO service_role;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_self_read" ON public.points_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.points_ledger_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'points_ledger is append-only';
END $$;
DROP TRIGGER IF EXISTS trg_points_ledger_no_update ON public.points_ledger;
CREATE TRIGGER trg_points_ledger_no_update
  BEFORE UPDATE OR DELETE ON public.points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.points_ledger_block_mutations();

CREATE TABLE IF NOT EXISTS public.points_accrual_buckets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL,
  rule_id                  uuid NOT NULL REFERENCES public.points_rules(id),
  campaign_id              uuid,
  eligible_bids_remaining  integer NOT NULL DEFAULT 0 CHECK (eligible_bids_remaining >= 0),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_id, campaign_id)
);
GRANT SELECT ON public.points_accrual_buckets TO authenticated;
GRANT ALL    ON public.points_accrual_buckets TO service_role;
ALTER TABLE public.points_accrual_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buckets_self_read" ON public.points_accrual_buckets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.auction_points_settlements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id        uuid NOT NULL,
  version           integer NOT NULL DEFAULT 1,
  status            public.points_settlement_status NOT NULL DEFAULT 'PENDING',
  winner_id         uuid,
  started_at        timestamptz,
  completed_at      timestamptz,
  reversed_at       timestamptz,
  idempotency_key   text NOT NULL,
  created_by        uuid,
  reason            text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  UNIQUE (auction_id, version)
);
GRANT SELECT ON public.auction_points_settlements TO authenticated;
GRANT ALL    ON public.auction_points_settlements TO service_role;
ALTER TABLE public.auction_points_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settlements_admin_all" ON public.auction_points_settlements
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.auction_points_settlement_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id         uuid NOT NULL REFERENCES public.auction_points_settlements(id) ON DELETE CASCADE,
  auction_id            uuid NOT NULL,
  user_id               uuid NOT NULL,
  rule_id               uuid NOT NULL REFERENCES public.points_rules(id),
  campaign_id           uuid,
  eligible_bids_count   integer NOT NULL CHECK (eligible_bids_count >= 0),
  carryover_before      integer NOT NULL DEFAULT 0,
  total_eligible_bids   integer NOT NULL,
  points_awarded        bigint  NOT NULL,
  carryover_after       integer NOT NULL DEFAULT 0,
  ledger_id             uuid REFERENCES public.points_ledger(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_id, user_id, rule_id, campaign_id)
);
GRANT SELECT ON public.auction_points_settlement_items TO authenticated;
GRANT ALL    ON public.auction_points_settlement_items TO service_role;
ALTER TABLE public.auction_points_settlement_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settlement_items_self_read" ON public.auction_points_settlement_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_auction_final_for_points(p_auction_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auctions a
    WHERE a.id = p_auction_id
      AND a.status IN ('finished','completed','ended')
      AND a.finished_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public._points_ensure_wallet(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.points_wallets(user_id) VALUES (p_user)
  ON CONFLICT (user_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.points_settle_auction(
  p_auction_id uuid,
  p_actor      uuid DEFAULT NULL,
  p_reason     text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_program_enabled boolean;
  v_accrual_enabled boolean;
  v_cutoff          timestamptz;
  v_settlement_id   uuid;
  v_version         integer;
  v_winner          uuid;
  v_idem            text;
  r                 record;
  v_bucket_before   integer;
  v_total           integer;
  v_points          bigint;
  v_carry_after     integer;
  v_ledger_id       uuid;
  v_avail_before    bigint;
  v_reserved_before bigint;
BEGIN
  SELECT setting_value INTO v_program_enabled
    FROM public.points_program_settings_bool WHERE setting_key='points_program_enabled';
  SELECT setting_value INTO v_accrual_enabled
    FROM public.points_program_settings_bool WHERE setting_key='points_accrual_enabled';
  SELECT setting_value INTO v_cutoff
    FROM public.points_program_settings_time WHERE setting_key='points_accrual_started_at';

  IF NOT public.is_auction_final_for_points(p_auction_id) THEN
    RAISE EXCEPTION 'auction_not_final:%', p_auction_id;
  END IF;

  SELECT winner_id INTO v_winner FROM public.auctions WHERE id = p_auction_id;

  v_idem := 'auction_settle:' || p_auction_id::text;

  SELECT COALESCE(MAX(version),0) + 1 INTO v_version
    FROM public.auction_points_settlements WHERE auction_id = p_auction_id;

  INSERT INTO public.auction_points_settlements
    (auction_id, version, status, winner_id, started_at, idempotency_key, created_by, reason)
  VALUES
    (p_auction_id, v_version, 'PROCESSING', v_winner, now(), v_idem || ':v' || v_version, p_actor, p_reason)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_settlement_id;

  IF v_settlement_id IS NULL THEN
    RAISE NOTICE 'settlement already exists for auction %', p_auction_id;
    RETURN (SELECT id FROM public.auction_points_settlements
             WHERE idempotency_key = v_idem || ':v' || v_version);
  END IF;

  IF COALESCE(v_program_enabled,false) IS DISTINCT FROM true
     OR COALESCE(v_accrual_enabled,false) IS DISTINCT FROM true
     OR v_cutoff IS NULL THEN
    UPDATE public.auction_points_settlements
       SET status='FAILED', completed_at=now(),
           reason=COALESCE(reason,'') || ' program_disabled'
     WHERE id = v_settlement_id;
    RETURN v_settlement_id;
  END IF;

  FOR r IN
    SELECT b.user_id, b.points_rule_id AS rule_id, b.points_campaign_id AS campaign_id,
           SUM( GREATEST(1, COALESCE(b.points_multiplier_snapshot,1)) )::int AS eligible_count
      FROM public.bids b
      JOIN public.profiles p ON p.id = b.user_id
     WHERE b.auction_id = p_auction_id
       AND b.eligible_for_points = true
       AND b.created_at >= v_cutoff
       AND b.user_id IS DISTINCT FROM v_winner
       AND COALESCE(p.is_bot, false) = false
       AND COALESCE(p.is_test_account, false) = false
       AND NOT public.is_admin_user(b.user_id)
       AND b.points_rule_id IS NOT NULL
     GROUP BY b.user_id, b.points_rule_id, b.points_campaign_id
  LOOP
    PERFORM public._points_ensure_wallet(r.user_id);

    SELECT eligible_bids_remaining INTO v_bucket_before
      FROM public.points_accrual_buckets
     WHERE user_id = r.user_id AND rule_id = r.rule_id
       AND campaign_id IS NOT DISTINCT FROM r.campaign_id
     FOR UPDATE;

    IF v_bucket_before IS NULL THEN
      INSERT INTO public.points_accrual_buckets(user_id, rule_id, campaign_id, eligible_bids_remaining)
      VALUES (r.user_id, r.rule_id, r.campaign_id, 0)
      RETURNING eligible_bids_remaining INTO v_bucket_before;
    END IF;

    v_total := v_bucket_before + r.eligible_count;
    SELECT (v_total / bids_per_point)::bigint,
           (v_total % bids_per_point)::int
      INTO v_points, v_carry_after
      FROM public.points_rules WHERE id = r.rule_id;

    SELECT available_points, reserved_points INTO v_avail_before, v_reserved_before
      FROM public.points_wallets WHERE user_id = r.user_id FOR UPDATE;

    IF v_points > 0 THEN
      INSERT INTO public.points_ledger(
        user_id, transaction_type, points_delta,
        available_before, available_after, reserved_before, reserved_after,
        auction_id, settlement_id, rule_id, campaign_id, admin_id,
        reason, idempotency_key)
      VALUES (
        r.user_id, 'EARN_AUCTION', v_points,
        v_avail_before, v_avail_before + v_points,
        v_reserved_before, v_reserved_before,
        p_auction_id, v_settlement_id, r.rule_id, r.campaign_id, p_actor,
        'auction settlement', v_idem||':v'||v_version||':'||r.user_id||':'||r.rule_id||':'||COALESCE(r.campaign_id::text,'none'))
      RETURNING id INTO v_ledger_id;

      UPDATE public.points_wallets
         SET available_points = available_points + v_points,
             lifetime_earned  = lifetime_earned + v_points,
             updated_at = now()
       WHERE user_id = r.user_id;
    END IF;

    UPDATE public.points_accrual_buckets
       SET eligible_bids_remaining = v_carry_after, updated_at = now()
     WHERE user_id = r.user_id AND rule_id = r.rule_id
       AND campaign_id IS NOT DISTINCT FROM r.campaign_id;

    INSERT INTO public.auction_points_settlement_items(
      settlement_id, auction_id, user_id, rule_id, campaign_id,
      eligible_bids_count, carryover_before, total_eligible_bids,
      points_awarded, carryover_after, ledger_id)
    VALUES (
      v_settlement_id, p_auction_id, r.user_id, r.rule_id, r.campaign_id,
      r.eligible_count, v_bucket_before, v_total,
      v_points, v_carry_after, v_ledger_id);
  END LOOP;

  UPDATE public.auction_points_settlements
     SET status='COMPLETED', completed_at=now(), updated_at=now()
   WHERE id = v_settlement_id;

  RETURN v_settlement_id;
END $$;

REVOKE ALL ON FUNCTION public.points_settle_auction(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.points_settle_auction(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.points_reverse_settlement(
  p_settlement_id uuid, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orig record;
  v_new_id uuid;
  it record;
  v_avail bigint;
  v_res   bigint;
  v_ledger uuid;
BEGIN
  SELECT * INTO v_orig FROM public.auction_points_settlements
   WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND OR v_orig.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'settlement_not_reversible:%', p_settlement_id;
  END IF;

  INSERT INTO public.auction_points_settlements(
    auction_id, version, status, winner_id, started_at, idempotency_key, reason, metadata)
  VALUES (v_orig.auction_id, v_orig.version + 1000, 'REVERSED',
          v_orig.winner_id, now(),
          'reverse:' || p_settlement_id::text,
          p_reason,
          jsonb_build_object('reverses', p_settlement_id))
  RETURNING id INTO v_new_id;

  FOR it IN
    SELECT * FROM public.auction_points_settlement_items
     WHERE settlement_id = p_settlement_id AND points_awarded > 0
  LOOP
    SELECT available_points, reserved_points INTO v_avail, v_res
      FROM public.points_wallets WHERE user_id = it.user_id FOR UPDATE;

    INSERT INTO public.points_ledger(
      user_id, transaction_type, points_delta,
      available_before, available_after, reserved_before, reserved_after,
      auction_id, settlement_id, rule_id, campaign_id,
      reason, idempotency_key)
    VALUES (
      it.user_id, 'ORDER_REVERSAL', -it.points_awarded,
      v_avail, v_avail - it.points_awarded, v_res, v_res,
      it.auction_id, v_new_id, it.rule_id, it.campaign_id,
      p_reason,
      'reverse:' || p_settlement_id::text || ':' || it.user_id::text)
    RETURNING id INTO v_ledger;

    UPDATE public.points_wallets
       SET available_points = available_points - it.points_awarded,
           lifetime_reversed = lifetime_reversed + it.points_awarded,
           updated_at = now()
     WHERE user_id = it.user_id;
  END LOOP;

  UPDATE public.auction_points_settlements
     SET status='SUPERSEDED', reversed_at=now(), updated_at=now()
   WHERE id = p_settlement_id;

  UPDATE public.auction_points_settlements
     SET completed_at=now() WHERE id = v_new_id;
  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.points_reverse_settlement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.points_reverse_settlement(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.points_reserve(
  p_user uuid, p_amount bigint, p_redemption uuid, p_idem text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a bigint; v_r bigint; v_ledger uuid; BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  PERFORM public._points_ensure_wallet(p_user);
  SELECT available_points, reserved_points INTO v_a, v_r
    FROM public.points_wallets WHERE user_id = p_user FOR UPDATE;
  IF v_a < p_amount THEN RAISE EXCEPTION 'insufficient_points'; END IF;
  UPDATE public.points_wallets
     SET available_points = available_points - p_amount,
         reserved_points  = reserved_points  + p_amount,
         updated_at = now()
   WHERE user_id = p_user;
  INSERT INTO public.points_ledger(
    user_id, transaction_type, points_delta,
    available_before, available_after, reserved_before, reserved_after,
    redemption_id, reason, idempotency_key)
  VALUES (p_user, 'RESERVE_REDEMPTION', -p_amount,
          v_a, v_a - p_amount, v_r, v_r + p_amount,
          p_redemption, 'reserve for redemption', p_idem)
  RETURNING id INTO v_ledger;
  RETURN v_ledger;
END $$;

CREATE OR REPLACE FUNCTION public.points_confirm_reservation(
  p_user uuid, p_amount bigint, p_redemption uuid, p_idem text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a bigint; v_r bigint; v_ledger uuid; BEGIN
  SELECT available_points, reserved_points INTO v_a, v_r
    FROM public.points_wallets WHERE user_id = p_user FOR UPDATE;
  IF v_r < p_amount THEN RAISE EXCEPTION 'insufficient_reserved'; END IF;
  UPDATE public.points_wallets
     SET reserved_points  = reserved_points  - p_amount,
         lifetime_redeemed = lifetime_redeemed + p_amount,
         updated_at = now()
   WHERE user_id = p_user;
  INSERT INTO public.points_ledger(
    user_id, transaction_type, points_delta,
    available_before, available_after, reserved_before, reserved_after,
    redemption_id, reason, idempotency_key)
  VALUES (p_user, 'CONFIRM_REDEMPTION', 0,
          v_a, v_a, v_r, v_r - p_amount,
          p_redemption, 'confirm redemption', p_idem)
  RETURNING id INTO v_ledger;
  RETURN v_ledger;
END $$;

CREATE OR REPLACE FUNCTION public.points_release_reservation(
  p_user uuid, p_amount bigint, p_redemption uuid, p_idem text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a bigint; v_r bigint; v_ledger uuid; BEGIN
  SELECT available_points, reserved_points INTO v_a, v_r
    FROM public.points_wallets WHERE user_id = p_user FOR UPDATE;
  IF v_r < p_amount THEN RAISE EXCEPTION 'insufficient_reserved'; END IF;
  UPDATE public.points_wallets
     SET reserved_points  = reserved_points  - p_amount,
         available_points = available_points + p_amount,
         updated_at = now()
   WHERE user_id = p_user;
  INSERT INTO public.points_ledger(
    user_id, transaction_type, points_delta,
    available_before, available_after, reserved_before, reserved_after,
    redemption_id, reason, idempotency_key)
  VALUES (p_user, 'RELEASE_REDEMPTION', p_amount,
          v_a, v_a + p_amount, v_r, v_r - p_amount,
          p_redemption, 'release redemption', p_idem)
  RETURNING id INTO v_ledger;
  RETURN v_ledger;
END $$;

CREATE OR REPLACE FUNCTION public.points_admin_adjust(
  p_user uuid, p_delta bigint, p_reason text, p_admin uuid, p_idem text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a bigint; v_r bigint; v_ledger uuid; v_type public.points_ledger_type; BEGIN
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION 'not_admin'; END IF;
  PERFORM public._points_ensure_wallet(p_user);
  SELECT available_points, reserved_points INTO v_a, v_r
    FROM public.points_wallets WHERE user_id = p_user FOR UPDATE;
  IF p_delta = 0 THEN RAISE EXCEPTION 'invalid_delta'; END IF;
  IF p_delta < 0 AND v_a < -p_delta THEN RAISE EXCEPTION 'insufficient_points'; END IF;
  v_type := CASE WHEN p_delta > 0 THEN 'ADMIN_CREDIT'::public.points_ledger_type
                                   ELSE 'ADMIN_DEBIT'::public.points_ledger_type END;
  UPDATE public.points_wallets
     SET available_points = available_points + p_delta, updated_at = now()
   WHERE user_id = p_user;
  INSERT INTO public.points_ledger(
    user_id, transaction_type, points_delta,
    available_before, available_after, reserved_before, reserved_after,
    admin_id, reason, idempotency_key)
  VALUES (p_user, v_type, p_delta, v_a, v_a + p_delta, v_r, v_r,
          p_admin, p_reason, p_idem)
  RETURNING id INTO v_ledger;
  RETURN v_ledger;
END $$;

REVOKE ALL ON FUNCTION public.points_admin_adjust(uuid, bigint, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.points_admin_adjust(uuid, bigint, text, uuid, text) TO service_role;

-- =====================================================================
-- Fase 2B — Loja e Resgates
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.points_store_item_status AS ENUM
    ('DRAFT','ACTIVE','PAUSED','OUT_OF_STOCK','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.points_store_item_type AS ENUM ('PHYSICAL','DIGITAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.points_inventory_movement_type AS ENUM
    ('ENTRY','RESERVE','RELEASE','REDEMPTION','ADJUSTMENT','LOSS','DAMAGE','RETURN','CANCELLATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.points_redemption_status AS ENUM
    ('PENDING','APPROVED','REJECTED','SEPARATING','SHIPPED','DELIVERED','CANCELLED','REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.points_store_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_store_categories TO anon, authenticated;
GRANT ALL    ON public.points_store_categories TO service_role;
ALTER TABLE public.points_store_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cats_read_all"  ON public.points_store_categories FOR SELECT USING (true);
CREATE POLICY "cats_admin_all" ON public.points_store_categories FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.points_store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  full_description  text,
  category_id uuid REFERENCES public.points_store_categories(id),
  brand text, model text, sku text UNIQUE,
  main_image_url text,
  cost_points bigint NOT NULL CHECK (cost_points > 0),
  internal_cost_brl numeric(12,2),
  reference_value_brl numeric(12,2),
  stock_total     integer NOT NULL DEFAULT 0 CHECK (stock_total >= 0),
  stock_reserved  integer NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  stock_available integer GENERATED ALWAYS AS (stock_total - stock_reserved) STORED,
  stock_min       integer NOT NULL DEFAULT 0,
  per_user_limit  integer,
  item_type public.points_store_item_type NOT NULL DEFAULT 'PHYSICAL',
  status    public.points_store_item_status NOT NULL DEFAULT 'DRAFT',
  featured  boolean NOT NULL DEFAULT false,
  estimated_days integer,
  free_shipping  boolean NOT NULL DEFAULT false,
  weight_g integer,
  dimensions jsonb,
  supplier text,
  on_demand boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (stock_reserved <= stock_total)
);
GRANT SELECT ON public.points_store_items TO authenticated;
GRANT ALL    ON public.points_store_items TO service_role;
ALTER TABLE public.points_store_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_read_active" ON public.points_store_items FOR SELECT TO authenticated
  USING (status IN ('ACTIVE','PAUSED','OUT_OF_STOCK') OR public.is_admin_user(auth.uid()));
CREATE POLICY "items_admin_all" ON public.points_store_items FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.points_store_item_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.points_store_items(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_store_item_images TO authenticated;
GRANT ALL    ON public.points_store_item_images TO service_role;
ALTER TABLE public.points_store_item_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imgs_read"      ON public.points_store_item_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "imgs_admin_all" ON public.points_store_item_images FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.points_store_item_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.points_store_items(id) ON DELETE CASCADE,
  old_cost_points bigint,
  new_cost_points bigint NOT NULL,
  admin_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_store_item_price_history TO authenticated;
GRANT ALL    ON public.points_store_item_price_history TO service_role;
ALTER TABLE public.points_store_item_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_hist_admin" ON public.points_store_item_price_history FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public._points_price_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cost_points IS DISTINCT FROM OLD.cost_points THEN
    INSERT INTO public.points_store_item_price_history(item_id, old_cost_points, new_cost_points, admin_id)
    VALUES (NEW.id, OLD.cost_points, NEW.cost_points, auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_price_hist ON public.points_store_items;
CREATE TRIGGER trg_price_hist AFTER UPDATE OF cost_points ON public.points_store_items
  FOR EACH ROW EXECUTE FUNCTION public._points_price_history();

CREATE TABLE IF NOT EXISTS public.points_store_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.points_store_items(id),
  movement_type public.points_inventory_movement_type NOT NULL,
  quantity_delta integer NOT NULL,
  stock_before integer NOT NULL,
  stock_after  integer NOT NULL,
  redemption_id uuid,
  admin_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_store_inventory_movements TO authenticated;
GRANT ALL    ON public.points_store_inventory_movements TO service_role;
ALTER TABLE public.points_store_inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_admin_all" ON public.points_store_inventory_movements FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE SEQUENCE IF NOT EXISTS public.points_redemptions_order_seq;

CREATE TABLE IF NOT EXISTS public.points_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE
    DEFAULT ('PSL-' || lpad(nextval('public.points_redemptions_order_seq')::text, 6, '0')),
  user_id uuid NOT NULL,
  status public.points_redemption_status NOT NULL DEFAULT 'PENDING',
  total_points bigint NOT NULL CHECK (total_points > 0),
  shipping_address_snapshot jsonb,
  shipping_method text,
  shipping_cost numeric(12,2) DEFAULT 0,
  tracking_code text,
  carrier text,
  admin_notes text,
  approved_by uuid,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_redemptions TO authenticated;
GRANT ALL    ON public.points_redemptions TO service_role;
ALTER TABLE public.points_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "red_self_read" ON public.points_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));
CREATE POLICY "red_admin_all" ON public.points_redemptions FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.points_redemption_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_id uuid NOT NULL REFERENCES public.points_redemptions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.points_store_items(id),
  item_snapshot jsonb NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  points_unit  bigint NOT NULL,
  points_total bigint NOT NULL,
  internal_cost_snapshot numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_redemption_items TO authenticated;
GRANT ALL    ON public.points_redemption_items TO service_role;
ALTER TABLE public.points_redemption_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "red_items_self" ON public.points_redemption_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.points_redemptions r
                  WHERE r.id = redemption_id
                    AND (r.user_id = auth.uid() OR public.is_admin_user(auth.uid()))));

CREATE TABLE IF NOT EXISTS public.points_redemption_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_id uuid NOT NULL REFERENCES public.points_redemptions(id) ON DELETE CASCADE,
  old_status public.points_redemption_status,
  new_status public.points_redemption_status NOT NULL,
  actor uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_redemption_status_history TO authenticated;
GRANT ALL    ON public.points_redemption_status_history TO service_role;
ALTER TABLE public.points_redemption_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "red_hist_admin_or_self" ON public.points_redemption_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.points_redemptions r
                  WHERE r.id = redemption_id
                    AND (r.user_id = auth.uid() OR public.is_admin_user(auth.uid()))));

CREATE OR REPLACE FUNCTION public.store_visible_for(p_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_program boolean; v_store boolean; v_mode text; v_ids jsonb; v_pct int;
BEGIN
  SELECT setting_value INTO v_program FROM public.points_program_settings_bool
   WHERE setting_key='points_program_enabled';
  SELECT setting_value INTO v_store   FROM public.points_program_settings_bool
   WHERE setting_key='points_store_enabled';
  IF COALESCE(v_program,false)=false OR COALESCE(v_store,false)=false THEN RETURN false; END IF;

  SELECT setting_value::text INTO v_mode FROM public.points_program_settings_json
   WHERE setting_key='audience_mode';
  IF public.is_admin_user(p_user) THEN RETURN true; END IF;

  v_mode := COALESCE(trim(both '"' from v_mode), 'admin_only');
  IF v_mode = 'admin_only' THEN RETURN false;
  ELSIF v_mode = 'all' THEN RETURN true;
  ELSIF v_mode = 'pilot' THEN
    SELECT setting_value INTO v_ids FROM public.points_program_settings_json
     WHERE setting_key='audience_pilot_user_ids';
    RETURN v_ids IS NOT NULL AND v_ids ? p_user::text;
  ELSIF v_mode = 'percent' THEN
    SELECT setting_value INTO v_pct FROM public.points_program_settings_num
     WHERE setting_key='audience_percent';
    RETURN (('x'||substr(md5(p_user::text),1,8))::bit(32)::int % 100) < COALESCE(v_pct,0);
  END IF;
  RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION public.store_visible_for(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_create(
  p_items jsonb, p_shipping jsonb, p_idem text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_store_on boolean; v_redeem_on boolean;
  v_total bigint := 0;
  v_red_id uuid;
  it jsonb; v_item record; v_qty int; v_stock_before int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.store_visible_for(v_user) THEN RAISE EXCEPTION 'store_not_visible'; END IF;

  SELECT setting_value INTO v_store_on  FROM public.points_program_settings_bool WHERE setting_key='points_store_enabled';
  SELECT setting_value INTO v_redeem_on FROM public.points_program_settings_bool WHERE setting_key='points_redemption_enabled';
  IF COALESCE(v_store_on,false)=false OR COALESCE(v_redeem_on,false)=false THEN RAISE EXCEPTION 'store_disabled'; END IF;

  INSERT INTO public.points_redemptions(user_id, total_points, shipping_address_snapshot, idempotency_key)
  VALUES (v_user, 0, p_shipping, p_idem)
  RETURNING id INTO v_red_id;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((it->>'quantity')::int, 1);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;

    SELECT * INTO v_item FROM public.points_store_items
     WHERE id = (it->>'item_id')::uuid FOR UPDATE;
    IF NOT FOUND OR v_item.status <> 'ACTIVE' THEN RAISE EXCEPTION 'item_unavailable:%', it->>'item_id'; END IF;
    IF v_item.stock_available < v_qty THEN RAISE EXCEPTION 'insufficient_stock:%', v_item.id; END IF;
    IF v_item.per_user_limit IS NOT NULL THEN
      IF (SELECT COALESCE(SUM(ri.quantity),0)
            FROM public.points_redemption_items ri
            JOIN public.points_redemptions r ON r.id = ri.redemption_id
           WHERE r.user_id = v_user AND ri.item_id = v_item.id
             AND r.status NOT IN ('REJECTED','CANCELLED','REVERSED')) + v_qty > v_item.per_user_limit THEN
        RAISE EXCEPTION 'per_user_limit_exceeded:%', v_item.id;
      END IF;
    END IF;

    v_stock_before := v_item.stock_reserved;
    UPDATE public.points_store_items SET stock_reserved = stock_reserved + v_qty, updated_at = now()
     WHERE id = v_item.id;
    INSERT INTO public.points_store_inventory_movements(
      item_id, movement_type, quantity_delta, stock_before, stock_after, redemption_id, reason)
    VALUES (v_item.id, 'RESERVE', v_qty, v_stock_before, v_stock_before + v_qty, v_red_id, 'redemption pending');

    INSERT INTO public.points_redemption_items(
      redemption_id, item_id, item_snapshot, quantity, points_unit, points_total, internal_cost_snapshot)
    VALUES (v_red_id, v_item.id, to_jsonb(v_item),
            v_qty, v_item.cost_points, v_item.cost_points * v_qty, v_item.internal_cost_brl);

    v_total := v_total + v_item.cost_points * v_qty;
  END LOOP;

  PERFORM public.points_reserve(v_user, v_total, v_red_id, 'redeem:'||v_red_id::text);

  UPDATE public.points_redemptions SET total_points = v_total, updated_at = now() WHERE id = v_red_id;
  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (v_red_id, NULL, 'PENDING', v_user, 'created');
  RETURN v_red_id;
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_create(jsonb, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_approve(
  p_redemption uuid, p_admin uuid, p_notes text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; it record; v_before int; BEGIN
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO r FROM public.points_redemptions WHERE id = p_redemption FOR UPDATE;
  IF r.status <> 'PENDING' THEN RAISE EXCEPTION 'not_pending'; END IF;

  PERFORM public.points_confirm_reservation(r.user_id, r.total_points, r.id, 'confirm:'||r.id::text);

  FOR it IN SELECT * FROM public.points_redemption_items WHERE redemption_id = r.id LOOP
    SELECT stock_total INTO v_before FROM public.points_store_items WHERE id = it.item_id FOR UPDATE;
    UPDATE public.points_store_items
       SET stock_total    = stock_total    - it.quantity,
           stock_reserved = stock_reserved - it.quantity,
           updated_at = now()
     WHERE id = it.item_id;
    INSERT INTO public.points_store_inventory_movements(
      item_id, movement_type, quantity_delta, stock_before, stock_after, redemption_id, admin_id, reason)
    VALUES (it.item_id, 'REDEMPTION', -it.quantity, v_before, v_before - it.quantity, r.id, p_admin, 'approved');
  END LOOP;

  UPDATE public.points_redemptions
     SET status='APPROVED', approved_by=p_admin, approved_at=now(),
         admin_notes = COALESCE(admin_notes,'') || COALESCE(' '||p_notes,''),
         updated_at=now()
   WHERE id = r.id;
  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (r.id, 'PENDING', 'APPROVED', p_admin, p_notes);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_reject(
  p_redemption uuid, p_admin uuid, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; it record; v_before int; BEGIN
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO r FROM public.points_redemptions WHERE id = p_redemption FOR UPDATE;
  IF r.status <> 'PENDING' THEN RAISE EXCEPTION 'not_pending'; END IF;

  PERFORM public.points_release_reservation(r.user_id, r.total_points, r.id, 'release:'||r.id::text);

  FOR it IN SELECT * FROM public.points_redemption_items WHERE redemption_id = r.id LOOP
    SELECT stock_reserved INTO v_before FROM public.points_store_items WHERE id = it.item_id FOR UPDATE;
    UPDATE public.points_store_items
       SET stock_reserved = stock_reserved - it.quantity, updated_at = now()
     WHERE id = it.item_id;
    INSERT INTO public.points_store_inventory_movements(
      item_id, movement_type, quantity_delta, stock_before, stock_after, redemption_id, admin_id, reason)
    VALUES (it.item_id, 'RELEASE', -it.quantity, v_before, v_before - it.quantity, r.id, p_admin, p_reason);
  END LOOP;

  UPDATE public.points_redemptions
     SET status='REJECTED', rejected_at=now(),
         admin_notes = COALESCE(admin_notes,'') || COALESCE(' '||p_reason,''),
         updated_at=now()
   WHERE id = r.id;
  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (r.id, 'PENDING', 'REJECTED', p_admin, p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_cancel(
  p_redemption uuid, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; it record; v_before int; v_actor uuid := auth.uid(); BEGIN
  SELECT * INTO r FROM public.points_redemptions WHERE id = p_redemption FOR UPDATE;
  IF r.status <> 'PENDING' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF r.user_id <> v_actor AND NOT public.is_admin_user(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;

  PERFORM public.points_release_reservation(r.user_id, r.total_points, r.id, 'release:'||r.id::text);
  FOR it IN SELECT * FROM public.points_redemption_items WHERE redemption_id = r.id LOOP
    SELECT stock_reserved INTO v_before FROM public.points_store_items WHERE id = it.item_id FOR UPDATE;
    UPDATE public.points_store_items SET stock_reserved = stock_reserved - it.quantity WHERE id = it.item_id;
    INSERT INTO public.points_store_inventory_movements(
      item_id, movement_type, quantity_delta, stock_before, stock_after, redemption_id, admin_id, reason)
    VALUES (it.item_id, 'CANCELLATION', -it.quantity, v_before, v_before - it.quantity, r.id, v_actor, p_reason);
  END LOOP;

  UPDATE public.points_redemptions SET status='CANCELLED', cancelled_at=now(), updated_at=now() WHERE id = r.id;
  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (r.id, 'PENDING', 'CANCELLED', v_actor, p_reason);
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_cancel(uuid, text) TO authenticated;