
CREATE OR REPLACE FUNCTION public.execute_panic_bids()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_leader_id uuid;
  v_is_bot boolean;
  v_predefined_match boolean;
  v_bid_count int;
  v_min_bids int;
  v_checked int := 0;
  v_scheduled int := 0;
  v_exec jsonb;
  v_executed int := 0;
BEGIN
  FOR v_auction IN
    SELECT id, title, last_bid_at, scheduled_bot_bid_at,
           predefined_winner_id, predefined_winner_ids,
           open_win_mode, min_bids_to_qualify
    FROM public.auctions
    WHERE status = 'active'
      AND last_bid_at < now() - interval '13500 milliseconds'
      AND (
        scheduled_bot_bid_at IS NULL
        OR scheduled_bot_bid_at > last_bid_at + interval '14 seconds'
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    v_checked := v_checked + 1;

    -- Verifica líder real elegível (predefinido OU open_win_mode) para pausar bots
    SELECT user_id INTO v_leader_id
    FROM public.bids
    WHERE auction_id = v_auction.id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_leader_id IS NOT NULL THEN
      -- predefinido (array novo OU legado singular)
      v_predefined_match :=
        (v_auction.predefined_winner_ids IS NOT NULL AND v_leader_id = ANY(v_auction.predefined_winner_ids))
        OR (v_auction.predefined_winner_id IS NOT NULL AND v_leader_id = v_auction.predefined_winner_id);

      IF v_predefined_match THEN
        CONTINUE; -- bots pausados
      END IF;

      -- open_win_mode: líder real (não bot) com lances suficientes
      IF v_auction.open_win_mode = true THEN
        SELECT is_bot INTO v_is_bot FROM public.profiles WHERE user_id = v_leader_id;
        IF v_is_bot = false THEN
          v_min_bids := COALESCE(v_auction.min_bids_to_qualify, 0);
          IF v_min_bids <= 0 THEN
            CONTINUE;
          END IF;
          SELECT COUNT(*) INTO v_bid_count FROM public.bids
          WHERE auction_id = v_auction.id AND user_id = v_leader_id;
          IF v_bid_count >= v_min_bids THEN
            CONTINUE;
          END IF;
        END IF;
      END IF;
    END IF;

    UPDATE public.auctions
    SET scheduled_bot_bid_at = now() + interval '300 milliseconds',
        scheduled_bot_band = 'panic'
    WHERE id = v_auction.id;

    v_scheduled := v_scheduled + 1;
  END LOOP;

  IF v_scheduled > 0 THEN
    BEGIN
      v_exec := public.execute_overdue_bot_bids();
      v_executed := COALESCE((v_exec->>'executed')::int, 0);
    EXCEPTION WHEN OTHERS THEN
      v_executed := 0;
    END;
  END IF;

  RETURN jsonb_build_object(
    'checked', v_checked,
    'scheduled', v_scheduled,
    'executed', v_executed,
    'timestamp', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_panic_bids() TO service_role;
