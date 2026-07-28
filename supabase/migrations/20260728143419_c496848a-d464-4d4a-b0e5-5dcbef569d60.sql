CREATE OR REPLACE FUNCTION public.credit_paid_bid_purchase(p_user_id uuid, p_bid_purchase_id uuid, p_bids_amount integer, p_amount_paid numeric, p_payment_environment text, p_payment_gateway text, p_gateway_account_id text, p_external_payment_id text, p_gateway_event_id text, p_gateway_payload_hash text, p_payment_created_at timestamp with time zone, p_payment_confirmed_at timestamp with time zone, p_webhook_received_at timestamp with time zone DEFAULT now())
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

  SELECT COALESCE(bids_balance,0) INTO v_old_balance FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;

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
    v_pay_eligible, v_pay_eligible,
    true, v_lot_status
  ) RETURNING id INTO v_new_lot_id;

  UPDATE public.profiles
     SET bids_balance = COALESCE(bids_balance,0) + p_bids_amount
   WHERE user_id = p_user_id
   RETURNING bids_balance INTO v_new_balance;

  IF v_new_balance IS NULL OR (v_new_balance - v_old_balance) <> p_bids_amount THEN
    RAISE EXCEPTION 'credit_paid_bid_purchase: divergência de saldo (delta=% esperado=%)',
      (v_new_balance - v_old_balance), p_bids_amount USING ERRCODE='data_exception';
  END IF;

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
END $function$;

-- Backfill: credita nos perfis os lotes canônicos já criados mas cujo saldo
-- nunca foi somado por causa do bug de coluna (id vs user_id).
WITH missing AS (
  SELECT bl.user_id, SUM(bl.initial_amount)::int AS delta
  FROM public.bid_lots bl
  JOIN public.bid_purchases bp ON bp.id = bl.bid_purchase_id
  WHERE bl.source = 'paid_purchase'
    AND bl.credited_via_canonical_rpc = true
    AND bp.payment_status = 'completed'
    AND bl.created_at >= '2026-07-28'::date
  GROUP BY bl.user_id
)
UPDATE public.profiles p
   SET bids_balance = COALESCE(p.bids_balance,0) + m.delta
  FROM missing m
 WHERE p.user_id = m.user_id;