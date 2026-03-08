
-- =============================================
-- 1. Fix affected auctions: assign bot winners where real users won with insufficient revenue
-- =============================================

-- Fix auction 5d9fc594 (Tiago Vieira, R$75/R$5000)
UPDATE auctions SET 
  winner_id = (SELECT public.get_random_bot()),
  winner_name = (SELECT full_name FROM profiles WHERE user_id = (SELECT public.get_random_bot()))
WHERE id = '5d9fc594-ea24-4b25-944f-7397e9f6bdde';

-- Fix auction 32cee777 (Priscila Sena, R$4/R$5000)
UPDATE auctions SET 
  winner_id = (SELECT public.get_random_bot()),
  winner_name = (SELECT full_name FROM profiles WHERE user_id = (SELECT public.get_random_bot()))
WHERE id = '32cee777-c5ae-488c-a8b8-f921167748ee';

-- Fix auction 9cb99034 (Luiz C., R$3/R$5000)
UPDATE auctions SET 
  winner_id = (SELECT public.get_random_bot()),
  winner_name = (SELECT full_name FROM profiles WHERE user_id = (SELECT public.get_random_bot()))
WHERE id = '9cb99034-3abd-4602-8b8e-6e36e40d94f0';

-- =============================================
-- 2. Fix bot_protection_loop: replace timezone('America/Sao_Paulo', now()) with now()
-- =============================================
CREATE OR REPLACE FUNCTION public.bot_protection_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_seconds_since_last_bid integer;
  v_bid_probability numeric;
  v_bot_user_id uuid;
  v_new_price numeric;
  v_current_time timestamptz;
  v_last_bid_user_id uuid;
  v_winner_name text;
  v_recent_bot_exists boolean;
  v_activated integer := 0;
  v_last_bid_is_bot boolean;
BEGIN
  v_current_time := now();
  
  RAISE LOG '🔄 [BOT-LOOP] Passagem única - %', v_current_time;

  -- FASE 0: Ativar leilões em espera cujo starts_at já passou
  UPDATE auctions
  SET status = 'active',
      time_left = 15,
      last_bid_at = now(),
      updated_at = now()
  WHERE status = 'waiting'
    AND starts_at IS NOT NULL
    AND starts_at <= now();
  
  GET DIAGNOSTICS v_activated = ROW_COUNT;
  IF v_activated > 0 THEN
    RAISE LOG '✅ [BOT-LOOP] % leilão(ões) waiting -> active', v_activated;
  END IF;

  FOR v_auction IN
    SELECT id, title, current_price, market_value, company_revenue, revenue_target,
           last_bid_at, bid_increment, ends_at, max_price, status
    FROM auctions
    WHERE status = 'active'
  LOOP
    v_seconds_since_last_bid := EXTRACT(EPOCH FROM (v_current_time - v_auction.last_bid_at))::integer;

    -- =============================================
    -- FINALIZAÇÃO POR HORÁRIO LIMITE (ends_at)
    -- =============================================
    IF v_auction.ends_at IS NOT NULL AND v_current_time >= v_auction.ends_at THEN
      IF v_auction.company_revenue >= v_auction.revenue_target THEN
        SELECT user_id INTO v_last_bid_user_id
        FROM bids WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;

        SELECT full_name INTO v_winner_name
        FROM profiles WHERE user_id = v_last_bid_user_id;

        UPDATE auctions SET status = 'finished', finished_at = v_auction.ends_at,
          winner_id = v_last_bid_user_id, winner_name = v_winner_name
        WHERE id = v_auction.id;

        RAISE LOG '⏰ [BOT-LOOP] Leilão "%" finalizado - horário limite + meta OK', v_auction.title;
      ELSE
        SELECT b.user_id, COALESCE(p.is_bot, false)
        INTO v_last_bid_user_id, v_last_bid_is_bot
        FROM bids b
        JOIN profiles p ON p.user_id = b.user_id
        WHERE b.auction_id = v_auction.id
        ORDER BY b.created_at DESC LIMIT 1;

        IF v_last_bid_user_id IS NOT NULL AND NOT v_last_bid_is_bot THEN
          SELECT public.get_random_bot() INTO v_bot_user_id;
          IF v_bot_user_id IS NOT NULL THEN
            SELECT full_name INTO v_winner_name FROM profiles WHERE user_id = v_bot_user_id;
            
            UPDATE auctions SET status = 'finished', finished_at = v_auction.ends_at,
              winner_id = v_bot_user_id, winner_name = v_winner_name
            WHERE id = v_auction.id;

            RAISE LOG '🛡️ [BOT-LOOP] Leilão "%" finalizado por ends_at - bot protegeu (receita insuficiente)', v_auction.title;
          ELSE
            UPDATE auctions SET status = 'finished', finished_at = v_auction.ends_at,
              winner_id = NULL, winner_name = NULL
            WHERE id = v_auction.id;
            RAISE LOG '⚠️ [BOT-LOOP] Leilão "%" finalizado sem vencedor (sem bot disponível)', v_auction.title;
          END IF;
        ELSE
          SELECT full_name INTO v_winner_name FROM profiles WHERE user_id = v_last_bid_user_id;

          UPDATE auctions SET status = 'finished', finished_at = v_auction.ends_at,
            winner_id = v_last_bid_user_id, winner_name = v_winner_name
          WHERE id = v_auction.id;

          RAISE LOG '⏰ [BOT-LOOP] Leilão "%" finalizado - horário limite (bot venceu, receita insuficiente)', v_auction.title;
        END IF;
      END IF;
      CONTINUE;
    END IF;

    -- =============================================
    -- FINALIZAÇÃO POR PREÇO MÁXIMO (max_price)
    -- =============================================
    IF v_auction.max_price IS NOT NULL AND v_auction.current_price >= v_auction.max_price THEN
      SELECT user_id INTO v_last_bid_user_id
      FROM bids WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;

      SELECT full_name INTO v_winner_name
      FROM profiles WHERE user_id = v_last_bid_user_id;

      UPDATE auctions SET status = 'finished', finished_at = v_current_time,
        winner_id = v_last_bid_user_id, winner_name = v_winner_name
      WHERE id = v_auction.id;

      RAISE LOG '💰 [BOT-LOOP] Leilão "%" finalizado - preço máximo R$%', v_auction.title, v_auction.max_price;
      CONTINUE;
    END IF;

    -- =============================================
    -- FINALIZAÇÃO POR META DE RECEITA
    -- =============================================
    IF v_auction.company_revenue >= v_auction.revenue_target THEN
      SELECT user_id INTO v_last_bid_user_id
      FROM bids WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;

      SELECT full_name INTO v_winner_name
      FROM profiles WHERE user_id = v_last_bid_user_id;

      UPDATE auctions SET status = 'finished', finished_at = v_current_time,
        winner_id = v_last_bid_user_id, winner_name = v_winner_name
      WHERE id = v_auction.id;

      RAISE LOG '🎯 [BOT-LOOP] Leilão "%" finalizado - meta de receita atingida', v_auction.title;
      CONTINUE;
    END IF;

    -- =============================================
    -- LANCE DE BOT PROBABILÍSTICO
    -- =============================================
    IF v_seconds_since_last_bid >= 13 THEN
      v_bid_probability := 1.0;
    ELSIF v_seconds_since_last_bid >= 10 THEN
      v_bid_probability := 0.25;
    ELSE
      v_bid_probability := 0;
    END IF;

    IF v_bid_probability = 0 OR random() > v_bid_probability THEN
      CONTINUE;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM bids
      WHERE auction_id = v_auction.id
        AND cost_paid = 0
        AND created_at > now() - interval '3 seconds'
    ) INTO v_recent_bot_exists;

    IF v_recent_bot_exists THEN
      CONTINUE;
    END IF;

    SELECT public.get_random_bot() INTO v_bot_user_id;
    IF v_bot_user_id IS NOT NULL THEN
      v_new_price := v_auction.current_price + v_auction.bid_increment;

      INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
      VALUES (v_auction.id, v_bot_user_id, v_new_price, 0);

      IF v_auction.current_price > v_auction.market_value THEN
        SELECT user_id INTO v_last_bid_user_id
        FROM bids WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;

        SELECT full_name INTO v_winner_name
        FROM profiles WHERE user_id = v_last_bid_user_id;

        UPDATE auctions SET status = 'finished', finished_at = v_current_time,
          winner_id = v_last_bid_user_id, winner_name = v_winner_name
        WHERE id = v_auction.id;

        RAISE LOG '💰 [BOT-LOOP] Leilão "%" finalizado - prejuízo evitado R$% > R$%', v_auction.title, v_auction.current_price, v_auction.market_value;
      ELSE
        RAISE LOG '🤖 [BOT-LOOP] Bot reaqueceu "%" - R$%', v_auction.title, v_new_price;
      END IF;
    END IF;

  END LOOP;

  RAISE LOG '✅ [BOT-LOOP] Passagem concluída';
END;
$$;

-- =============================================
-- 3. Fix prevent_bids_on_inactive_auctions: replace timezone() with now()
-- =============================================
CREATE OR REPLACE FUNCTION public.prevent_bids_on_inactive_auctions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  a RECORD;
BEGIN
  SELECT id, status, ends_at, time_left INTO a
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  IF a.status <> 'active' OR 
     (a.ends_at IS NOT NULL AND a.ends_at < now() - INTERVAL '5 seconds') OR 
     COALESCE(a.time_left, 0) < -5 THEN
    RAISE EXCEPTION 'Cannot place bids on inactive or finished auctions';
  END IF;

  RETURN NEW;
END;
$$;
