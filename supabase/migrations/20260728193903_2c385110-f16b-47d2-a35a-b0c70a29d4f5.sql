
-- Helper: retorna se um usuário está na audiência atual do programa
CREATE OR REPLACE FUNCTION public.points_user_in_audience(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_audience jsonb := public.points_get_json('audience_mode');
  v_pilot    jsonb := public.points_get_json('points_pilot_users');
  v_mode     text;
  v_percent  int;
  v_is_admin boolean := false;
BEGIN
  IF v_audience IS NULL THEN
    RETURN false;
  END IF;

  v_mode := COALESCE(v_audience->>'mode', 'admin_only');

  IF v_mode = 'all' THEN
    RETURN true;
  ELSIF v_mode = 'admin_only' THEN
    SELECT COALESCE(is_admin,false) INTO v_is_admin FROM public.profiles WHERE user_id = _user_id;
    RETURN COALESCE(v_is_admin,false);
  ELSIF v_mode = 'pilot' THEN
    RETURN COALESCE(v_pilot ? _user_id::text, false);
  ELSIF v_mode = 'percent' THEN
    v_percent := COALESCE((v_audience->>'percent')::int, 0);
    RETURN (abs(hashtext(_user_id::text)) % 100) < v_percent;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.points_user_in_audience(uuid) TO authenticated, service_role;

-- place_bid: substitui a checagem de piloto pela função de audiência
CREATE OR REPLACE FUNCTION public.place_bid(p_auction_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance                numeric;
  v_bid_id                 uuid;
  v_program_on             boolean := public.points_get_bool('points_program_enabled', false);
  v_accrual_on             boolean := public.points_get_bool('points_accrual_enabled', false);
  v_consumption_on         boolean := public.points_get_bool('points_lot_consumption_enabled', false);
  v_started_at             timestamptz := public.points_get_time('points_accrual_started_at');
  v_is_bot                 boolean := false;
  v_is_admin               boolean := false;
  v_is_test                boolean := false;
  v_in_audience            boolean := false;
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

  v_in_audience := public.points_user_in_audience(p_user_id);

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

  IF v_is_bot OR v_is_admin OR v_is_test OR NOT v_in_audience OR NOT v_accrual_active_snap THEN
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

-- Backfill: reclassifica bids pagos já registrados após o corte que ficaram inelegíveis por causa da audiência
DO $$
DECLARE
  v_started_at timestamptz := public.points_get_time('points_accrual_started_at');
BEGIN
  IF v_started_at IS NULL THEN
    RAISE NOTICE 'points_accrual_started_at is null; skipping backfill';
    RETURN;
  END IF;

  UPDATE public.bids b
     SET eligible_for_points = true
    FROM public.bid_lots l,
         public.profiles p
   WHERE b.lot_id = l.id
     AND b.user_id = p.user_id
     AND b.eligible_for_points = false
     AND b.source = 'paid_purchase'
     AND l.source = 'paid_purchase'
     AND l.eligible_for_points = true
     AND b.created_at >= v_started_at
     AND COALESCE(p.is_bot,false) = false
     AND COALESCE(p.is_admin,false) = false
     AND COALESCE(p.is_test_account,false) = false
     AND public.points_user_in_audience(b.user_id);
END $$;
