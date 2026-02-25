
-- 1. Criar a function bot_protection_loop()
CREATE OR REPLACE FUNCTION public.bot_protection_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '90s'
SET search_path TO 'public'
AS $$
DECLARE
  v_iteration integer;
  v_auction RECORD;
  v_seconds_since_last_bid integer;
  v_bot_user_id uuid;
  v_new_price numeric;
  v_bid_probability numeric;
  v_recent_bot_exists boolean;
  v_last_bid_user_id uuid;
  v_winner_name text;
  v_now timestamptz;
  v_bot_bids integer := 0;
  v_finalized integer := 0;
BEGIN
  FOR v_iteration IN 1..6 LOOP
    v_now := timezone('America/Sao_Paulo', now());
    v_bot_bids := 0;
    v_finalized := 0;

    FOR v_auction IN
      SELECT id, title, current_price, market_value, company_revenue, 
             revenue_target, last_bid_at, bid_increment, ends_at, max_price
      FROM auctions
      WHERE status = 'active'
    LOOP
      -- Calcular inatividade
      v_seconds_since_last_bid := EXTRACT(EPOCH FROM (v_now - v_auction.last_bid_at))::integer;

      -- === VERIFICAÇÕES DE FINALIZAÇÃO ===

      -- Horário limite
      IF v_auction.ends_at IS NOT NULL AND v_now >= v_auction.ends_at THEN
        SELECT user_id INTO v_last_bid_user_id
        FROM bids WHERE auction_id = v_auction.id
        ORDER BY created_at DESC LIMIT 1;

        SELECT full_name INTO v_winner_name
        FROM profiles WHERE user_id = v_last_bid_user_id;

        UPDATE auctions SET status = 'finished', finished_at = v_now,
          winner_id = v_last_bid_user_id, winner_name = v_winner_name
        WHERE id = v_auction.id;

        v_finalized := v_finalized + 1;
        RAISE LOG '[BOT-LOOP] Finalizado "%" - horário limite', v_auction.title;
        CONTINUE;
      END IF;

      -- Preço máximo
      IF v_auction.max_price IS NOT NULL AND v_auction.current_price >= v_auction.max_price THEN
        SELECT user_id INTO v_last_bid_user_id
        FROM bids WHERE auction_id = v_auction.id
        ORDER BY created_at DESC LIMIT 1;

        SELECT full_name INTO v_winner_name
        FROM profiles WHERE user_id = v_last_bid_user_id;

        UPDATE auctions SET status = 'finished', finished_at = v_now,
          winner_id = v_last_bid_user_id, winner_name = v_winner_name
        WHERE id = v_auction.id;

        v_finalized := v_finalized + 1;
        RAISE LOG '[BOT-LOOP] Finalizado "%" - preço máximo', v_auction.title;
        CONTINUE;
      END IF;

      -- Meta de receita atingida
      IF v_auction.company_revenue >= v_auction.revenue_target THEN
        SELECT user_id INTO v_last_bid_user_id
        FROM bids WHERE auction_id = v_auction.id
        ORDER BY created_at DESC LIMIT 1;

        SELECT full_name INTO v_winner_name
        FROM profiles WHERE user_id = v_last_bid_user_id;

        UPDATE auctions SET status = 'finished', finished_at = v_now,
          winner_id = v_last_bid_user_id, winner_name = v_winner_name
        WHERE id = v_auction.id;

        v_finalized := v_finalized + 1;
        RAISE LOG '[BOT-LOOP] Finalizado "%" - meta atingida', v_auction.title;
        CONTINUE;
      END IF;

      -- === LÓGICA DE BOT BID ===

      -- Determinar probabilidade
      IF v_seconds_since_last_bid >= 8 THEN
        v_bid_probability := 1.0;
      ELSIF v_seconds_since_last_bid >= 5 THEN
        v_bid_probability := 0.3;
      ELSE
        CONTINUE; -- Menos de 5s, ignorar
      END IF;

      -- Teste probabilístico
      IF random() > v_bid_probability THEN
        CONTINUE;
      END IF;

      -- Anti-spam: verificar bot recente nos últimos 5s
      SELECT EXISTS(
        SELECT 1 FROM bids
        WHERE auction_id = v_auction.id
          AND cost_paid = 0
          AND created_at > v_now - interval '5 seconds'
      ) INTO v_recent_bot_exists;

      IF v_recent_bot_exists THEN
        CONTINUE;
      END IF;

      -- Obter bot aleatório
      v_bot_user_id := get_random_bot();

      IF v_bot_user_id IS NULL THEN
        CONTINUE;
      END IF;

      v_new_price := v_auction.current_price + COALESCE(v_auction.bid_increment, 0.01);

      -- Inserir bid de bot
      INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
      VALUES (v_auction.id, v_bot_user_id, v_new_price, 0);

      v_bot_bids := v_bot_bids + 1;

      -- Verificar prejuízo após o lance
      IF v_auction.current_price > v_auction.market_value THEN
        SELECT user_id INTO v_last_bid_user_id
        FROM bids WHERE auction_id = v_auction.id
        ORDER BY created_at DESC LIMIT 1;

        SELECT full_name INTO v_winner_name
        FROM profiles WHERE user_id = v_last_bid_user_id;

        UPDATE auctions SET status = 'finished', finished_at = v_now,
          winner_id = v_last_bid_user_id, winner_name = v_winner_name
        WHERE id = v_auction.id;

        v_finalized := v_finalized + 1;
        RAISE LOG '[BOT-LOOP] Finalizado "%" - prejuízo (R$% > R$%)', v_auction.title, v_auction.current_price, v_auction.market_value;
      END IF;

    END LOOP;

    RAISE LOG '[BOT-LOOP] Iteração %/6 - Bots: %, Finalizados: %', v_iteration, v_bot_bids, v_finalized;

    -- Esperar 10s antes da próxima iteração (exceto na última)
    IF v_iteration < 6 THEN
      PERFORM pg_sleep(10);
    END IF;

  END LOOP;

  RAISE LOG '[BOT-LOOP] Ciclo completo (6 iterações)';
END;
$$;

-- 2. Remover o cron job antigo que usa pg_net
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE '%sync-timers%' OR jobname LIKE '%protection%' OR jobname LIKE '%bot%';

-- 3. Criar novo cron job que executa a function diretamente
SELECT cron.schedule(
  'bot-protection-loop',
  '* * * * *',
  'SELECT public.bot_protection_loop()'
);
