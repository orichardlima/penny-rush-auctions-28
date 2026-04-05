CREATE OR REPLACE FUNCTION public.bot_protection_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- =============================================
    -- FINALIZAÇÃO POR HORÁRIO LIMITE
    -- =============================================
    IF v_auction.ends_at IS NOT NULL AND v_current_time >= v_auction.ends_at THEN
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'time_limit', v_current_time);
      CONTINUE;
    END IF;

    -- =============================================
    -- FINALIZAÇÃO POR PREÇO MÁXIMO
    -- =============================================
    IF v_auction.max_price IS NOT NULL AND v_auction.current_price >= v_auction.max_price THEN
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'max_price', v_current_time);
      CONTINUE;
    END IF;

    -- =============================================
    -- FINALIZAÇÃO POR META DE RECEITA
    -- =============================================
    IF v_auction.company_revenue >= v_auction.revenue_target THEN
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'revenue_target', v_current_time);
      CONTINUE;
    END IF;

    -- =============================================
    -- SAFETY NET: INATIVIDADE >= 60s
    -- =============================================
    IF v_seconds_since_last_bid >= 60 THEN
      RAISE LOG '🚨 [BOT-LOOP] "%" - %s sem lance, finalizando (safety net)', v_auction.title, v_seconds_since_last_bid;
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'inactivity_forced', v_current_time);
      CONTINUE;
    END IF;

    -- =============================================
    -- FASE A: EXECUTAR AGENDAMENTO VENCIDO
    -- =============================================
    IF v_auction.scheduled_bot_bid_at IS NOT NULL THEN
      IF v_current_time >= v_auction.scheduled_bot_bid_at THEN
        -- Validar ciclo: agendamento pertence ao ciclo atual?
        IF v_auction.scheduled_bot_bid_at >= v_auction.last_bid_at THEN
          -- Ciclo válido: executar lance
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
          -- Agendamento obsoleto: limpar
          UPDATE auctions SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
          WHERE id = v_auction.id;
          RAISE LOG '🗑️ [BOT-STALE] "%" | agendamento obsoleto descartado', v_auction.title;
        END IF;
      END IF;
      -- Se ainda não é hora, skip (não agendar outro)
      CONTINUE;
    END IF;

    -- =============================================
    -- FASE B: AGENDAR NOVO LANCE (inatividade >= 5s, sem agendamento)
    -- =============================================
    IF v_seconds_since_last_bid >= 5 THEN
      -- Sortear faixa com anti-repetição
      v_rand := random();
      IF v_rand < 0.20 THEN
        v_band := 'early';
        v_delay_sec := 2 + floor(random() * 4)::integer; -- 2-5s
      ELSIF v_rand < 0.60 THEN
        v_band := 'middle';
        v_delay_sec := 6 + floor(random() * 4)::integer; -- 6-9s
      ELSIF v_rand < 0.90 THEN
        v_band := 'late';
        v_delay_sec := 10 + floor(random() * 3)::integer; -- 10-12s
      ELSE
        v_band := 'sniper';
        v_delay_sec := 13 + floor(random() * 2)::integer; -- 13-14s
      END IF;
      
      -- Anti-repetição: re-sortear 1x se igual ao último
      IF v_band = v_auction.last_bot_band THEN
        v_rand := random();
        IF v_rand < 0.20 THEN
          v_band := 'early';
          v_delay_sec := 2 + floor(random() * 4)::integer;
        ELSIF v_rand < 0.60 THEN
          v_band := 'middle';
          v_delay_sec := 6 + floor(random() * 4)::integer;
        ELSIF v_rand < 0.90 THEN
          v_band := 'late';
          v_delay_sec := 10 + floor(random() * 3)::integer;
        ELSE
          v_band := 'sniper';
          v_delay_sec := 13 + floor(random() * 2)::integer;
        END IF;
      END IF;
      
      v_scheduled_time := v_auction.last_bid_at + (v_delay_sec * interval '1 second');
      
      -- UPDATE atômico: só agenda se ninguém agendou antes
      UPDATE auctions
      SET scheduled_bot_bid_at = v_scheduled_time,
          scheduled_bot_band = v_band
      WHERE id = v_auction.id
        AND scheduled_bot_bid_at IS NULL;
      
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows > 0 THEN
        RAISE LOG '🤖 [BOT-SCHEDULE] "%" | band=% | delay=%s | target=%', v_auction.title, v_band, v_delay_sec, v_scheduled_time;
      END IF;
    END IF;

  END LOOP;
  
  RAISE LOG '✅ [BOT-LOOP] Passagem completa';
END;
$$;