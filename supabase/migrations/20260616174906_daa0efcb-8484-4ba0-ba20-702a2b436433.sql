CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auction RECORD;
  v_bid_increment NUMERIC;
  v_bid_cost NUMERIC;
  v_is_bot BOOLEAN;
BEGIN
  SELECT * INTO v_auction FROM public.auctions WHERE id = NEW.auction_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  IF v_auction.status != 'active' THEN
    RETURN NEW;
  END IF;
  
  v_bid_increment := COALESCE(v_auction.bid_increment, 0.01);
  v_bid_cost := COALESCE(v_auction.bid_cost, 1.50);
  
  SELECT COALESCE(is_bot, false) INTO v_is_bot
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  UPDATE public.auctions 
  SET 
    current_price = COALESCE(current_price, COALESCE(starting_price, 0)) + v_bid_increment,
    total_bids = COALESCE(total_bids, 0) + 1,
    company_revenue = COALESCE(company_revenue, 0) + 
      CASE WHEN NEW.cost_paid > 0 AND NOT v_is_bot THEN v_bid_cost ELSE 0 END,
    time_left = 15,
    last_bid_at = clock_timestamp(),
    updated_at = clock_timestamp(),
    scheduled_bot_bid_at = NULL,
    scheduled_bot_band = NULL
  WHERE id = NEW.auction_id;
  
  RETURN NEW;
END;
$function$;

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
  v_winner_name text;
  v_activated integer := 0;
  v_bot_display text;
  v_current_bidders jsonb;
  v_name_parts text[];
  v_winner_city text;
  v_winner_state text;
  v_rows integer;
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
           scheduled_bot_bid_at, scheduled_bot_band, last_bot_band
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
          END IF;
        ELSE
          UPDATE auctions SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
          WHERE id = v_auction.id;
          RAISE LOG '🗑️ [BOT-STALE] "%" | agendamento obsoleto descartado', v_auction.title;
        END IF;
      END IF;
    END IF;

    IF v_auction.scheduled_bot_bid_at IS NULL AND v_seconds_since_last_bid >= 5 THEN
      v_rand := random();
      IF v_rand < 0.40 THEN
        v_band := 'early'; v_delay_sec := 5 + floor(random() * 4)::int;
      ELSIF v_rand < 0.75 THEN
        v_band := 'middle'; v_delay_sec := 9 + floor(random() * 3)::int;
      ELSIF v_rand < 0.95 THEN
        v_band := 'late'; v_delay_sec := 12 + floor(random() * 2)::int;
      ELSE
        v_band := 'sniper'; v_delay_sec := 14;
      END IF;

      IF v_auction.last_bot_band IS NOT NULL AND v_auction.last_bot_band = v_band THEN
        IF v_band = 'early' THEN v_band := 'middle'; v_delay_sec := 10;
        ELSIF v_band = 'middle' THEN v_band := 'late'; v_delay_sec := 13;
        ELSIF v_band = 'late' THEN v_band := 'early'; v_delay_sec := 7;
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