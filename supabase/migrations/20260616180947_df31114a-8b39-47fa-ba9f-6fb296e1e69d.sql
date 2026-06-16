CREATE OR REPLACE FUNCTION public.bot_protection_loop()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auction RECORD;
  v_seconds_since_last_bid integer;
  v_bot_user_id uuid;
  v_new_price numeric;
  v_current_time timestamptz;
  v_activated integer := 0;
  v_band text;
  v_delay_sec integer;
  v_rand numeric;
  v_scheduled_time timestamptz;
BEGIN
  v_current_time := clock_timestamp();

  RAISE LOG '🔄 [BOT-LOOP] Passagem - %', v_current_time;

  UPDATE auctions
  SET status = 'active', time_left = 15, last_bid_at = clock_timestamp(), updated_at = clock_timestamp()
  WHERE status = 'waiting' AND starts_at IS NOT NULL AND starts_at <= clock_timestamp();

  GET DIAGNOSTICS v_activated = ROW_COUNT;
  IF v_activated > 0 THEN
    RAISE LOG '✅ [BOT-LOOP] % leilão(ões) waiting -> active', v_activated;
  END IF;

  FOR v_auction IN
    SELECT id, title, current_price, market_value, company_revenue, revenue_target,
           last_bid_at, bid_increment, ends_at, max_price, status,
           scheduled_bot_bid_at, scheduled_bot_band, last_bot_band,
           predefined_winner_id, predefined_winner_ids, open_win_mode, min_bids_to_qualify
    FROM auctions
    WHERE status = 'active'
  LOOP
    v_seconds_since_last_bid := EXTRACT(EPOCH FROM (v_current_time - v_auction.last_bid_at))::integer;

    IF v_auction.ends_at IS NOT NULL AND v_current_time >= v_auction.ends_at THEN
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'time_limit', v_current_time);
      CONTINUE;
    END IF;

    IF v_auction.max_price IS NOT NULL AND v_auction.current_price >= v_auction.max_price THEN
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'max_price', v_current_time);
      CONTINUE;
    END IF;

    IF v_auction.company_revenue >= v_auction.revenue_target THEN
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'revenue_target', v_current_time);
      CONTINUE;
    END IF;

    IF v_seconds_since_last_bid >= 90 THEN
      RAISE LOG '🚨 [BOT-LOOP] "%" - %s sem lance, finalizando (safety net)', v_auction.title, v_seconds_since_last_bid;
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'inactivity_forced', v_current_time);
      CONTINUE;
    END IF;

    -- FASE A: EXECUTAR LANCE AGENDADO (se chegou a hora)
    IF v_auction.scheduled_bot_bid_at IS NOT NULL THEN
      IF v_current_time >= v_auction.scheduled_bot_bid_at THEN
        IF v_auction.scheduled_bot_bid_at >= v_auction.last_bid_at THEN
          SELECT public.get_random_bot() INTO v_bot_user_id;
          IF v_bot_user_id IS NOT NULL THEN
            v_new_price := v_auction.current_price + COALESCE(v_auction.bid_increment, 0.01);
            INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
            VALUES (v_auction.id, v_bot_user_id, v_new_price, 0);

            UPDATE auctions SET last_bot_band = v_auction.scheduled_bot_band,
              scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
            WHERE id = v_auction.id;

            RAISE LOG '🤖 [BOT-EXEC] "%" | band=% | R$%', v_auction.title, v_auction.scheduled_bot_band, v_new_price;
            CONTINUE;
          END IF;
        ELSE
          UPDATE auctions SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
          WHERE id = v_auction.id;
          RAISE LOG '🗑️ [BOT-STALE] "%" | agendamento obsoleto descartado', v_auction.title;
        END IF;
      END IF;
    END IF;

    -- FASE B: PANIC BID - timer com <= 6s e nenhum lance vai acontecer a tempo
    -- (assumindo timer de 15s: time_left = 15 - v_seconds_since_last_bid)
    -- Se time_left <= 6s (v_seconds_since_last_bid >= 9) e não há agendamento que execute logo,
    -- dispara lance imediato para o card NUNCA exibir "Verificando lances válidos" na disputa.
    IF v_seconds_since_last_bid >= 9
       AND (v_auction.scheduled_bot_bid_at IS NULL
            OR v_auction.scheduled_bot_bid_at > v_current_time + interval '1 second') THEN
      SELECT public.get_random_bot() INTO v_bot_user_id;
      IF v_bot_user_id IS NOT NULL THEN
        v_new_price := v_auction.current_price + COALESCE(v_auction.bid_increment, 0.01);
        INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
        VALUES (v_auction.id, v_bot_user_id, v_new_price, 0);

        UPDATE auctions
        SET last_bot_band = 'panic',
            scheduled_bot_bid_at = NULL,
            scheduled_bot_band = NULL
        WHERE id = v_auction.id;

        RAISE LOG '⚠️ [PANIC-BID] "%" | sec_since_last=% | R$%', v_auction.title, v_seconds_since_last_bid, v_new_price;
        CONTINUE;
      END IF;
    END IF;

    -- FASE C: AGENDAR PRÓXIMO LANCE (faixas 2-8s; gate 2s)
    IF v_auction.scheduled_bot_bid_at IS NULL AND v_seconds_since_last_bid >= 2 THEN
      v_rand := random();
      IF v_rand < 0.40 THEN
        v_band := 'early'; v_delay_sec := 2 + floor(random() * 3)::int;  -- 2-4s
      ELSIF v_rand < 0.75 THEN
        v_band := 'middle'; v_delay_sec := 4 + floor(random() * 3)::int; -- 4-6s
      ELSE
        v_band := 'late'; v_delay_sec := 6 + floor(random() * 3)::int;   -- 6-8s
      END IF;

      IF v_auction.last_bot_band IS NOT NULL AND v_auction.last_bot_band = v_band THEN
        IF v_band = 'early' THEN v_band := 'middle'; v_delay_sec := 5;
        ELSIF v_band = 'middle' THEN v_band := 'late'; v_delay_sec := 7;
        ELSIF v_band = 'late' THEN v_band := 'early'; v_delay_sec := 3;
        END IF;
      END IF;

      v_scheduled_time := v_auction.last_bid_at + (v_delay_sec || ' seconds')::interval;

      UPDATE auctions SET scheduled_bot_bid_at = v_scheduled_time, scheduled_bot_band = v_band
      WHERE id = v_auction.id;

      RAISE LOG '⏰ [BOT-SCHED] "%" | band=% | delay=%s | exec_at=%', v_auction.title, v_band, v_delay_sec, v_scheduled_time;
    END IF;
  END LOOP;
END;
$function$;