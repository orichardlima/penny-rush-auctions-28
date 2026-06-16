CREATE OR REPLACE FUNCTION public.bot_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- O tick legado agora apenas executa lances já agendados.
  -- Agendamento, PANIC e finalização ficam exclusivamente na edge function sync-timers-and-protection.
  PERFORM public.execute_overdue_bot_bids();
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_overdue_bot_bids()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auction RECORD;
  v_bot_id uuid;
  v_new_price numeric;
  v_executed int := 0;
  v_stale int := 0;
  v_skipped_expired int := 0;
  v_expired_timer int := 0;
  v_now timestamptz;
  v_actual_delay_ms numeric;
  v_time_left_at_exec numeric;
  v_scheduled_delay numeric;
  v_path text;
BEGIN
  UPDATE auctions
     SET scheduled_bot_bid_at = NULL,
         scheduled_bot_band = NULL
   WHERE status = 'active'
     AND scheduled_bot_bid_at IS NOT NULL
     AND ends_at IS NOT NULL
     AND ends_at < clock_timestamp() - interval '5 seconds';
  GET DIAGNOSTICS v_skipped_expired = ROW_COUNT;

  FOR v_auction IN
    SELECT id, current_price, bid_increment, scheduled_bot_bid_at, scheduled_bot_band, last_bid_at
    FROM auctions
    WHERE status = 'active'
      AND scheduled_bot_bid_at IS NOT NULL
      AND scheduled_bot_bid_at <= clock_timestamp()
      AND (ends_at IS NULL OR ends_at >= clock_timestamp() - interval '5 seconds')
    FOR UPDATE SKIP LOCKED
  LOOP
    v_now := clock_timestamp();
    v_time_left_at_exec := 15 - EXTRACT(EPOCH FROM (v_now - v_auction.last_bid_at));
    v_scheduled_delay := EXTRACT(EPOCH FROM (v_auction.scheduled_bot_bid_at - v_auction.last_bid_at));
    v_path := CASE WHEN v_auction.scheduled_bot_band = 'panic' THEN 'PANIC' ELSE 'NORMAL' END;

    IF v_auction.scheduled_bot_bid_at < v_auction.last_bid_at THEN
      UPDATE auctions
      SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
      WHERE id = v_auction.id;
      v_stale := v_stale + 1;
      CONTINUE;
    END IF;

    -- Não executa lance depois que o timer de 15s já zerou.
    IF v_time_left_at_exec <= 0 THEN
      RAISE LOG '%', jsonb_build_object(
        'tag', 'BOT-EXEC-SKIPPED',
        'reason', 'timer_expired',
        'auction_id', v_auction.id,
        'path', v_path,
        'band', v_auction.scheduled_bot_band,
        'scheduled_delay_after_last_bid', ROUND(v_scheduled_delay::numeric, 2),
        'scheduled_target_time', v_auction.scheduled_bot_bid_at,
        'actual_execution_time', v_now,
        'time_left_at_execution', ROUND(v_time_left_at_exec::numeric, 2)
      )::text;

      UPDATE auctions
      SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
      WHERE id = v_auction.id;
      v_expired_timer := v_expired_timer + 1;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM bids
      WHERE auction_id = v_auction.id
        AND cost_paid = 0
        AND created_at >= clock_timestamp() - interval '3 seconds'
      LIMIT 1
    ) THEN
      CONTINUE;
    END IF;

    SELECT user_id INTO v_bot_id
    FROM profiles
    WHERE is_bot = true
    ORDER BY random()
    LIMIT 1;

    IF v_bot_id IS NULL THEN CONTINUE; END IF;

    v_new_price := v_auction.current_price + COALESCE(v_auction.bid_increment, 0.01);

    BEGIN
      INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
      VALUES (v_auction.id, v_bot_id, v_new_price, 0);
    EXCEPTION WHEN OTHERS THEN
      UPDATE auctions
      SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
      WHERE id = v_auction.id;
      CONTINUE;
    END;

    v_now := clock_timestamp();
    v_actual_delay_ms := EXTRACT(EPOCH FROM (v_now - v_auction.scheduled_bot_bid_at)) * 1000;
    v_time_left_at_exec := GREATEST(0, 15 - EXTRACT(EPOCH FROM (v_now - v_auction.last_bid_at)));

    RAISE LOG '%', jsonb_build_object(
      'tag', 'BOT-EXEC',
      'auction_id', v_auction.id,
      'path', v_path,
      'band', v_auction.scheduled_bot_band,
      'scheduled_delay_after_last_bid', ROUND(v_scheduled_delay::numeric, 2),
      'scheduled_target_time', v_auction.scheduled_bot_bid_at,
      'actual_execution_time', v_now,
      'time_left_at_execution', ROUND(v_time_left_at_exec::numeric, 2),
      'actual_lag_ms', ROUND(v_actual_delay_ms::numeric, 0)
    )::text;

    UPDATE auctions
    SET last_bot_band = v_auction.scheduled_bot_band,
        scheduled_bot_bid_at = NULL,
        scheduled_bot_band = NULL
    WHERE id = v_auction.id;

    v_executed := v_executed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'executed', v_executed,
    'stale', v_stale,
    'skipped_expired', v_skipped_expired,
    'expired_timer', v_expired_timer
  );
END;
$function$;