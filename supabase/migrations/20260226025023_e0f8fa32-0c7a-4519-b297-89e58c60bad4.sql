
-- 1. Dropar a function existente
DROP FUNCTION IF EXISTS public.bot_protection_loop();

-- 2. Criar como PROCEDURE com COMMIT entre iterações e thresholds corrigidos
CREATE OR REPLACE PROCEDURE public.bot_protection_loop()
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auction RECORD;
  v_seconds_since_last_bid integer;
  v_bid_probability numeric;
  v_bot_user_id uuid;
  v_new_price numeric;
  v_current_time_br timestamptz;
  v_iteration integer;
  v_last_bid_user_id uuid;
  v_winner_name text;
  v_recent_bot_exists boolean;
BEGIN
  FOR v_iteration IN 1..6 LOOP
    v_current_time_br := timezone('America/Sao_Paulo', now());
    
    RAISE LOG '🔄 [BOT-LOOP] Iteração %/6 - %', v_iteration, v_current_time_br;

    FOR v_auction IN
      SELECT id, title, current_price, market_value, company_revenue, revenue_target,
             last_bid_at, bid_increment, ends_at, max_price, status
      FROM auctions
      WHERE status = 'active'
    LOOP
      -- Calcular tempo desde último lance
      v_seconds_since_last_bid := EXTRACT(EPOCH FROM (v_current_time_br - v_auction.last_bid_at))::integer;

      -- Verificar se horário limite foi atingido
      IF v_auction.ends_at IS NOT NULL AND v_current_time_br >= v_auction.ends_at THEN
        SELECT user_id INTO v_last_bid_user_id
        FROM bids WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;

        SELECT full_name INTO v_winner_name
        FROM profiles WHERE user_id = v_last_bid_user_id;

        UPDATE auctions SET status = 'finished', finished_at = v_current_time_br,
          winner_id = v_last_bid_user_id, winner_name = v_winner_name
        WHERE id = v_auction.id;

        RAISE LOG '⏰ [BOT-LOOP] Leilão "%" finalizado - horário limite', v_auction.title;
        CONTINUE;
      END IF;

      -- Verificar preço máximo
      IF v_auction.max_price IS NOT NULL AND v_auction.current_price >= v_auction.max_price THEN
        SELECT user_id INTO v_last_bid_user_id
        FROM bids WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;

        SELECT full_name INTO v_winner_name
        FROM profiles WHERE user_id = v_last_bid_user_id;

        UPDATE auctions SET status = 'finished', finished_at = v_current_time_br,
          winner_id = v_last_bid_user_id, winner_name = v_winner_name
        WHERE id = v_auction.id;

        RAISE LOG '💰 [BOT-LOOP] Leilão "%" finalizado - preço máximo', v_auction.title;
        CONTINUE;
      END IF;

      -- Verificar meta de receita
      IF v_auction.company_revenue >= v_auction.revenue_target THEN
        SELECT user_id INTO v_last_bid_user_id
        FROM bids WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;

        SELECT full_name INTO v_winner_name
        FROM profiles WHERE user_id = v_last_bid_user_id;

        UPDATE auctions SET status = 'finished', finished_at = v_current_time_br,
          winner_id = v_last_bid_user_id, winner_name = v_winner_name
        WHERE id = v_auction.id;

        RAISE LOG '🎯 [BOT-LOOP] Leilão "%" finalizado - meta atingida', v_auction.title;
        CONTINUE;
      END IF;

      -- Thresholds corrigidos (10s/13s)
      IF v_seconds_since_last_bid >= 13 THEN
        v_bid_probability := 1.0;
      ELSIF v_seconds_since_last_bid >= 10 THEN
        v_bid_probability := 0.25;
      ELSE
        CONTINUE;
      END IF;

      -- Roleta de probabilidade
      IF random() > v_bid_probability THEN
        CONTINUE;
      END IF;

      -- Anti-spam: verificar bot recente (3s)
      SELECT EXISTS(
        SELECT 1 FROM bids
        WHERE auction_id = v_auction.id AND cost_paid = 0
          AND created_at > v_current_time_br - interval '3 seconds'
      ) INTO v_recent_bot_exists;

      IF v_recent_bot_exists THEN
        CONTINUE;
      END IF;

      -- Buscar bot aleatório
      SELECT public.get_random_bot() INTO v_bot_user_id;

      IF v_bot_user_id IS NOT NULL THEN
        v_new_price := v_auction.current_price + v_auction.bid_increment;

        INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
        VALUES (v_auction.id, v_bot_user_id, v_new_price, 0);

        RAISE LOG '🤖 [BOT-LOOP] Bot reaqueceu "%" - R$%', v_auction.title, v_new_price;

        -- Se há prejuízo, finalizar
        IF v_auction.current_price > v_auction.market_value THEN
          SELECT user_id INTO v_last_bid_user_id
          FROM bids WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;

          SELECT full_name INTO v_winner_name
          FROM profiles WHERE user_id = v_last_bid_user_id;

          UPDATE auctions SET status = 'finished', finished_at = v_current_time_br,
            winner_id = v_last_bid_user_id, winner_name = v_winner_name
          WHERE id = v_auction.id;

          RAISE LOG '💰 [BOT-LOOP] Leilão "%" finalizado - prejuízo evitado', v_auction.title;
        END IF;
      END IF;

    END LOOP;

    -- COMMIT libera todos os locks desta iteração
    COMMIT;

    -- Aguardar antes da próxima iteração (exceto última)
    IF v_iteration < 6 THEN
      PERFORM pg_sleep(10);
    END IF;

  END LOOP;

  RAISE LOG '✅ [BOT-LOOP] Todas as 6 iterações concluídas';
END;
$$;

-- 3. Atualizar o cron job para usar CALL
SELECT cron.unschedule('bot-protection-loop');
SELECT cron.schedule(
  'bot-protection-loop',
  '* * * * *',
  'CALL public.bot_protection_loop()'
);
