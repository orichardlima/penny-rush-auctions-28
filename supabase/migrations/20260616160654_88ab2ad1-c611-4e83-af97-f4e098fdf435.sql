
-- 1) Corrigir execute_overdue_bot_bids para ignorar leilões já expirados
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
BEGIN
  -- Limpa agendamentos de leilões já expirados (serão finalizados pelo bot_protection_loop)
  UPDATE auctions
     SET scheduled_bot_bid_at = NULL,
         scheduled_bot_band = NULL
   WHERE status = 'active'
     AND scheduled_bot_bid_at IS NOT NULL
     AND ends_at IS NOT NULL
     AND ends_at < now() - interval '5 seconds';
  GET DIAGNOSTICS v_skipped_expired = ROW_COUNT;

  FOR v_auction IN
    SELECT id, current_price, bid_increment, scheduled_bot_bid_at, scheduled_bot_band, last_bid_at
    FROM auctions
    WHERE status = 'active'
      AND scheduled_bot_bid_at IS NOT NULL
      AND scheduled_bot_bid_at <= now()
      AND (ends_at IS NULL OR ends_at >= now() - interval '5 seconds')
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_auction.scheduled_bot_bid_at < v_auction.last_bid_at THEN
      UPDATE auctions
      SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
      WHERE id = v_auction.id;
      v_stale := v_stale + 1;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM bids
      WHERE auction_id = v_auction.id
        AND cost_paid = 0
        AND created_at >= now() - interval '3 seconds'
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

    v_new_price := v_auction.current_price + v_auction.bid_increment;

    BEGIN
      INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
      VALUES (v_auction.id, v_bot_id, v_new_price, 0);
    EXCEPTION WHEN OTHERS THEN
      -- proteção extra: se trigger rejeitar, limpa agendamento e segue
      UPDATE auctions
      SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
      WHERE id = v_auction.id;
      CONTINUE;
    END;

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
    'skipped_expired', v_skipped_expired
  );
END;
$function$;

-- 2) Cleanup: finalizar leilões que ficaram presos com ends_at expirado
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, title
    FROM auctions
    WHERE status = 'active'
      AND finished_at IS NULL
      AND ends_at IS NOT NULL
      AND ends_at < now() - interval '1 minute'
  LOOP
    PERFORM public._bot_finalize_auction(r.id, r.title, 'time_limit', now());
  END LOOP;
END $$;
