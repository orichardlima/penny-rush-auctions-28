CREATE OR REPLACE FUNCTION public.preview_consume_bid_lots(p_user_id uuid, p_amount numeric)
RETURNS TABLE(lot_id uuid, take numeric, eligible boolean, source text, bid_purchase_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz := public.points_get_time('points_accrual_started_at');
  v_prio jsonb := public.points_get_json('points_consumption_priority');
  v_remaining numeric := p_amount;
  r RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  IF (v_prio->>0) = 'eligible_paid' AND v_cutoff IS NOT NULL THEN
    FOR r IN
      SELECT
        bl.id AS lid,
        bl.remaining_amount AS rem,
        bl.source AS src,
        bl.bid_purchase_id AS bpi,
        COALESCE(bl.purchased_at, bl.payment_confirmed_at, bl.created_at) AS effective_purchase_at
      FROM public.bid_lots bl
      WHERE bl.user_id = p_user_id
        AND bl.remaining_amount > 0
        AND bl.eligible_for_points = true
        AND COALESCE(bl.purchased_at, bl.payment_confirmed_at, bl.created_at) > v_cutoff
        AND (bl.expires_at IS NULL OR bl.expires_at > now())
      ORDER BY COALESCE(bl.purchased_at, bl.payment_confirmed_at, bl.created_at) ASC, bl.id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      lot_id := r.lid;
      take := LEAST(r.rem, v_remaining);
      eligible := true;
      source := r.src;
      bid_purchase_id := r.bpi;
      v_remaining := v_remaining - take;
      RETURN NEXT;
    END LOOP;
  END IF;

  IF v_remaining > 0 THEN
    FOR r IN
      SELECT
        bl.id AS lid,
        bl.remaining_amount AS rem,
        bl.source AS src,
        bl.bid_purchase_id AS bpi,
        COALESCE(bl.purchased_at, bl.payment_confirmed_at, bl.created_at) AS effective_purchase_at
      FROM public.bid_lots bl
      WHERE bl.user_id = p_user_id
        AND bl.remaining_amount > 0
        AND (
          bl.eligible_for_points = false
          OR v_cutoff IS NULL
          OR COALESCE(bl.purchased_at, bl.payment_confirmed_at, bl.created_at) <= v_cutoff
        )
        AND (bl.expires_at IS NULL OR bl.expires_at > now())
      ORDER BY COALESCE(bl.purchased_at, bl.payment_confirmed_at, bl.created_at) ASC, bl.id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      lot_id := r.lid;
      take := LEAST(r.rem, v_remaining);
      eligible := false;
      source := r.src;
      bid_purchase_id := r.bpi;
      v_remaining := v_remaining - take;
      RETURN NEXT;
    END LOOP;
  END IF;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'insufficient_lot_balance' USING ERRCODE = 'P0001';
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.credit_paid_bid_purchase(
  p_user_id uuid,
  p_bid_purchase_id uuid,
  p_bids_amount integer,
  p_amount_paid numeric,
  p_payment_environment text,
  p_payment_gateway text,
  p_gateway_account_id text,
  p_external_payment_id text,
  p_gateway_event_id text,
  p_gateway_payload_hash text,
  p_payment_created_at timestamp with time zone,
  p_payment_confirmed_at timestamp with time zone,
  p_webhook_received_at timestamp with time zone DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF p_user_id IS NULL OR p_bid_purchase_id IS NULL OR p_bids_amount IS NULL OR p_bids_amount <= 0 THEN
    RAISE EXCEPTION 'credit_paid_bid_purchase: argumentos inválidos' USING ERRCODE='invalid_parameter_value';
  END IF;
  IF p_payment_environment IS NULL OR p_payment_gateway IS NULL OR p_external_payment_id IS NULL THEN
    RAISE EXCEPTION 'credit_paid_bid_purchase: identidade do pagamento obrigatória' USING ERRCODE='invalid_parameter_value';
  END IF;

  v_idem := 'lot:' || p_payment_environment || ':' || p_payment_gateway || ':'
         || COALESCE(p_gateway_account_id,'-') || ':' || p_external_payment_id;

  SELECT id INTO v_existing_lot FROM public.bid_lots WHERE idempotency_key = v_idem LIMIT 1;
  IF v_existing_lot IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'lot_id', v_existing_lot, 'reason','already_credited');
  END IF;

  v_lock_key := ('x' || substr(md5(p_bid_purchase_id::text),1,15))::bit(60)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

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

  SELECT id INTO v_existing_lot FROM public.bid_lots WHERE idempotency_key = v_idem LIMIT 1;
  IF v_existing_lot IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'lot_id', v_existing_lot, 'reason','already_credited_race');
  END IF;

  IF p_payment_confirmed_at IS NULL THEN
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

  PERFORM set_config('points.canonical_credit_active', p_bid_purchase_id::text, true);
  PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);

  SELECT COALESCE(bids_balance,0) INTO v_old_balance FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;

  INSERT INTO public.bid_lots (
    user_id, source, initial_amount, remaining_amount,
    bid_purchase_id, payment_environment, payment_gateway, gateway_account_id,
    external_payment_id, gateway_event_id, gateway_payload_hash, idempotency_key,
    payment_created_at, payment_confirmed_at, purchased_at, webhook_received_at, processed_at,
    payment_eligible_for_points, eligible_for_points,
    credited_via_canonical_rpc, lot_status
  ) VALUES (
    p_user_id, 'paid_purchase', p_bids_amount, p_bids_amount,
    p_bid_purchase_id, p_payment_environment, p_payment_gateway, p_gateway_account_id,
    p_external_payment_id, p_gateway_event_id, p_gateway_payload_hash, v_idem,
    p_payment_created_at, p_payment_confirmed_at, p_payment_confirmed_at, p_webhook_received_at, now(),
    v_pay_eligible, v_pay_eligible,
    true, v_lot_status
  ) RETURNING id INTO v_new_lot_id;

  UPDATE public.profiles
     SET bids_balance = COALESCE(bids_balance,0) + p_bids_amount
   WHERE user_id = p_user_id
   RETURNING bids_balance INTO v_new_balance;

  IF v_new_balance IS NULL OR (v_new_balance - v_old_balance) <> p_bids_amount THEN
    RAISE EXCEPTION 'credit_paid_bid_purchase: falha ao creditar saldo de lances' USING ERRCODE='check_violation';
  END IF;

  RETURN jsonb_build_object(
    'idempotent', false,
    'lot_id', v_new_lot_id,
    'eligible_for_points', v_pay_eligible,
    'old_balance', v_old_balance,
    'new_balance', v_new_balance
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.points_settle_auction(p_auction_id uuid, p_actor uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  SELECT value INTO v_program_enabled
    FROM public.points_program_settings_bool WHERE key='points_program_enabled';
  SELECT value INTO v_accrual_enabled
    FROM public.points_program_settings_bool WHERE key='points_accrual_enabled';
  SELECT value INTO v_cutoff
    FROM public.points_program_settings_time WHERE key='points_accrual_started_at';

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
      JOIN public.profiles p ON p.user_id = b.user_id
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
        v_avail_before, v_avail_before + v_points, v_reserved_before, v_reserved_before,
        p_auction_id, v_settlement_id, r.rule_id, r.campaign_id, p_actor,
        'Pontos Show por lances elegíveis em leilão não vencido',
        v_idem || ':' || r.user_id::text || ':' || r.rule_id::text || ':' || COALESCE(r.campaign_id::text,'none'))
      RETURNING id INTO v_ledger_id;

      UPDATE public.points_wallets
         SET available_points = available_points + v_points,
             lifetime_earned = lifetime_earned + v_points,
             updated_at = now()
       WHERE user_id = r.user_id;
    ELSE
      v_ledger_id := NULL;
    END IF;

    UPDATE public.points_accrual_buckets
       SET eligible_bids_remaining = v_carry_after,
           updated_at = now()
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
     SET status='COMPLETED', completed_at=now()
   WHERE id = v_settlement_id;

  RETURN v_settlement_id;
EXCEPTION WHEN OTHERS THEN
  IF v_settlement_id IS NOT NULL THEN
    UPDATE public.auction_points_settlements
       SET status='FAILED', completed_at=now(), reason=SQLERRM
     WHERE id = v_settlement_id;
  END IF;
  RAISE;
END
$function$;