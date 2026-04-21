-- 1. Aumentar safety net de 60s para 90s em bot_protection_loop
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
  v_current_time := now();
  
  RAISE LOG '🔄 [BOT-LOOP] Passagem - %', v_current_time;

  -- FASE 0: Ativar leilões em espera
  UPDATE auctions
  SET status = 'active', time_left = 15, last_bid_at = now(), updated_at = now()
  WHERE status = 'waiting' AND starts_at IS NOT NULL AND starts_at <= now();
  
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

    -- SAFETY NET: INATIVIDADE >= 90s (era 60s)
    IF v_seconds_since_last_bid >= 90 THEN
      RAISE LOG '🚨 [BOT-LOOP] "%" - %s sem lance, finalizando (safety net)', v_auction.title, v_seconds_since_last_bid;
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'inactivity_forced', v_current_time);
      CONTINUE;
    END IF;

    -- FASE A: EXECUTAR AGENDAMENTO VENCIDO
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

    -- FASE B: AGENDAR PRÓXIMO LANCE (se não há agendamento ativo)
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

-- 2. Criar função bot_tick: agendamento + execução em uma única passagem
CREATE OR REPLACE FUNCTION public.bot_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Primeiro executa lances vencidos, depois agenda próximos
  PERFORM public.execute_overdue_bot_bids();
  PERFORM public.bot_protection_loop();
END;
$function$;

-- 3. Wrapper safe com advisory lock (evita execuções concorrentes)
CREATE OR REPLACE FUNCTION public.bot_tick_safe()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT pg_try_advisory_lock(8675309) THEN
    RAISE LOG '⏭️ [BOT-TICK-SAFE] Skipped - lock busy';
    RETURN;
  END IF;
  
  BEGIN
    PERFORM public.bot_tick();
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(8675309);
    RAISE;
  END;
  
  PERFORM pg_advisory_unlock(8675309);
END;
$function$;

-- 4. Remover os 4 cron jobs antigos
DO $$
BEGIN
  PERFORM cron.unschedule('bot-protection-loop-00');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('bot-protection-loop-30');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('execute-overdue-bot-bids-00');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('execute-overdue-bot-bids-30');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Limpar quaisquer bot-tick-* preexistentes antes de recriar
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobname FROM cron.job WHERE jobname LIKE 'bot-tick-%' LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;
END $$;

-- 5. Criar 6 jobs por minuto (00, 10, 20, 30, 40, 50)
SELECT cron.schedule('bot-tick-00', '* * * * *', $$SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-10', '* * * * *', $$SELECT pg_sleep(10); SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-20', '* * * * *', $$SELECT pg_sleep(20); SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-30', '* * * * *', $$SELECT pg_sleep(30); SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-40', '* * * * *', $$SELECT pg_sleep(40); SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-50', '* * * * *', $$SELECT pg_sleep(50); SELECT public.bot_tick_safe();$$);