
CREATE OR REPLACE FUNCTION public.bot_protection_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '90s'
AS $$
DECLARE
  v_iteration INTEGER;
  v_auction RECORD;
  v_seconds_since_last_bid INTEGER;
  v_bid_probability FLOAT;
  v_random_bot UUID;
  v_new_price NUMERIC;
  v_last_bid_user UUID;
  v_winner_name TEXT;
  v_recent_bot_count INTEGER;
  v_now TIMESTAMPTZ;
BEGIN
  FOR v_iteration IN 1..6 LOOP
    -- Sleep 10s between iterations (skip first)
    IF v_iteration > 1 THEN
      PERFORM pg_sleep(10);
    END IF;

    v_now := now();

    -- Process each active auction
    FOR v_auction IN
      SELECT id, title, current_price, market_value, company_revenue, revenue_target,
             last_bid_at, bid_increment, ends_at, max_price
      FROM public.auctions
      WHERE status = 'active'
    LOOP
      v_seconds_since_last_bid := EXTRACT(EPOCH FROM (v_now - v_auction.last_bid_at))::INTEGER;

      -- Check finalization conditions first
      -- 1. Time limit reached
      IF v_auction.ends_at IS NOT NULL AND v_now >= v_auction.ends_at THEN
        SELECT user_id INTO v_last_bid_user FROM public.bids
          WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;
        SELECT full_name INTO v_winner_name FROM public.profiles
          WHERE user_id = v_last_bid_user;
        UPDATE public.auctions SET status = 'finished', finished_at = v_now,
          winner_id = v_last_bid_user, winner_name = v_winner_name
          WHERE id = v_auction.id;
        PERFORM public.fury_vault_distribute(v_auction.id);
        RAISE LOG '[BOT-LOOP] Finalized "%" - time limit', v_auction.title;
        CONTINUE;
      END IF;

      -- 2. Max price reached
      IF v_auction.max_price IS NOT NULL AND v_auction.current_price >= v_auction.max_price THEN
        SELECT user_id INTO v_last_bid_user FROM public.bids
          WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;
        SELECT full_name INTO v_winner_name FROM public.profiles
          WHERE user_id = v_last_bid_user;
        UPDATE public.auctions SET status = 'finished', finished_at = v_now,
          winner_id = v_last_bid_user, winner_name = v_winner_name
          WHERE id = v_auction.id;
        PERFORM public.fury_vault_distribute(v_auction.id);
        RAISE LOG '[BOT-LOOP] Finalized "%" - max price', v_auction.title;
        CONTINUE;
      END IF;

      -- 3. Revenue target reached
      IF v_auction.company_revenue >= v_auction.revenue_target THEN
        SELECT user_id INTO v_last_bid_user FROM public.bids
          WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;
        SELECT full_name INTO v_winner_name FROM public.profiles
          WHERE user_id = v_last_bid_user;
        UPDATE public.auctions SET status = 'finished', finished_at = v_now,
          winner_id = v_last_bid_user, winner_name = v_winner_name
          WHERE id = v_auction.id;
        PERFORM public.fury_vault_distribute(v_auction.id);
        RAISE LOG '[BOT-LOOP] Finalized "%" - revenue target', v_auction.title;
        CONTINUE;
      END IF;

      -- Probabilistic bot bid with NEW thresholds
      IF v_seconds_since_last_bid >= 13 THEN
        v_bid_probability := 1.0;   -- timer ~2s, lance garantido
      ELSIF v_seconds_since_last_bid >= 10 THEN
        v_bid_probability := 0.25;  -- timer ~5-3s, 25% chance
      ELSE
        CONTINUE;                    -- timer > 5s, ignora
      END IF;

      -- Roll probability
      IF random() > v_bid_probability THEN
        CONTINUE;
      END IF;

      -- Anti-spam: check recent bot bids
      SELECT COUNT(*) INTO v_recent_bot_count FROM public.bids
        WHERE auction_id = v_auction.id AND cost_paid = 0
          AND created_at >= (v_now - interval '5 seconds');
      IF v_recent_bot_count > 0 THEN
        CONTINUE;
      END IF;

      -- Get random bot
      SELECT public.get_random_bot() INTO v_random_bot;
      IF v_random_bot IS NULL THEN
        CONTINUE;
      END IF;

      v_new_price := v_auction.current_price + v_auction.bid_increment;

      -- Insert bot bid
      INSERT INTO public.bids (auction_id, user_id, bid_amount, cost_paid)
        VALUES (v_auction.id, v_random_bot, v_new_price, 0);

      RAISE LOG '[BOT-LOOP] Bot bid on "%" - R$% (inactivity: %s)', v_auction.title, v_new_price, v_seconds_since_last_bid;

      -- Check if price exceeds market value (loss prevention)
      IF v_auction.current_price > v_auction.market_value THEN
        SELECT user_id INTO v_last_bid_user FROM public.bids
          WHERE auction_id = v_auction.id ORDER BY created_at DESC LIMIT 1;
        SELECT full_name INTO v_winner_name FROM public.profiles
          WHERE user_id = v_last_bid_user;
        UPDATE public.auctions SET status = 'finished', finished_at = v_now,
          winner_id = v_last_bid_user, winner_name = v_winner_name
          WHERE id = v_auction.id;
        PERFORM public.fury_vault_distribute(v_auction.id);
        RAISE LOG '[BOT-LOOP] Finalized "%" - loss prevention', v_auction.title;
      END IF;

    END LOOP; -- auctions
  END LOOP; -- iterations
END;
$$;
