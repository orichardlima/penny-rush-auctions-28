
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
  v_bot_display text;
  v_current_bidders jsonb;
  v_name_parts text[];
  v_winner_city text;
  v_winner_state text;
  v_rows integer;
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
      SELECT public.get_random_bot() INTO v_bot_user_id;
      IF v_bot_user_id IS NOT NULL THEN
        SELECT full_name, city, state INTO v_winner_name, v_winner_city, v_winner_state
        FROM profiles WHERE user_id = v_bot_user_id;
        
        IF v_winner_city IS NOT NULL AND v_winner_state IS NOT NULL THEN
          v_winner_name := v_winner_name || ' - ' || v_winner_city || ', ' || v_winner_state;
        END IF;

        v_name_parts := string_to_array(trim(COALESCE((SELECT full_name FROM profiles WHERE user_id = v_bot_user_id), 'Bot')), ' ');
        IF array_length(v_name_parts, 1) >= 2 THEN
          v_bot_display := v_name_parts[1] || ' ' || v_name_parts[2];
        ELSE
          v_bot_display := v_name_parts[1];
        END IF;
        v_current_bidders := COALESCE((SELECT last_bidders FROM auctions WHERE id = v_auction.id), '[]'::jsonb);
        v_current_bidders := (to_jsonb(v_bot_display) || v_current_bidders);
        IF jsonb_array_length(v_current_bidders) > 3 THEN
          v_current_bidders := (SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY t(elem, ord) ORDER BY ord LIMIT 3) sub);
        END IF;
      END IF;

      UPDATE auctions SET status = 'finished', finished_at = v_auction.ends_at,
        winner_id = v_bot_user_id, winner_name = v_winner_name,
        last_bidders = COALESCE(v_current_bidders, last_bidders),
        finish_reason = 'time_limit'
      WHERE id = v_auction.id AND status = 'active' AND finished_at IS NULL;

      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows > 0 THEN
        RAISE LOG '⏰ [BOT-LOOP] Leilão "%" finalizado - horário limite (bot vencedor)', v_auction.title;
      END IF;
      CONTINUE;
    END IF;

    -- =============================================
    -- FINALIZAÇÃO POR PREÇO MÁXIMO (max_price)
    -- =============================================
    IF v_auction.max_price IS NOT NULL AND v_auction.current_price >= v_auction.max_price THEN
      SELECT public.get_random_bot() INTO v_bot_user_id;
      IF v_bot_user_id IS NOT NULL THEN
        SELECT full_name, city, state INTO v_winner_name, v_winner_city, v_winner_state
        FROM profiles WHERE user_id = v_bot_user_id;
        
        IF v_winner_city IS NOT NULL AND v_winner_state IS NOT NULL THEN
          v_winner_name := v_winner_name || ' - ' || v_winner_city || ', ' || v_winner_state;
        END IF;

        v_name_parts := string_to_array(trim(COALESCE((SELECT full_name FROM profiles WHERE user_id = v_bot_user_id), 'Bot')), ' ');
        IF array_length(v_name_parts, 1) >= 2 THEN
          v_bot_display := v_name_parts[1] || ' ' || v_name_parts[2];
        ELSE
          v_bot_display := v_name_parts[1];
        END IF;
        v_current_bidders := COALESCE((SELECT last_bidders FROM auctions WHERE id = v_auction.id), '[]'::jsonb);
        v_current_bidders := (to_jsonb(v_bot_display) || v_current_bidders);
        IF jsonb_array_length(v_current_bidders) > 3 THEN
          v_current_bidders := (SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY t(elem, ord) ORDER BY ord LIMIT 3) sub);
        END IF;
      END IF;

      UPDATE auctions SET status = 'finished', finished_at = v_current_time,
        winner_id = v_bot_user_id, winner_name = v_winner_name,
        last_bidders = COALESCE(v_current_bidders, last_bidders),
        finish_reason = 'max_price'
      WHERE id = v_auction.id AND status = 'active' AND finished_at IS NULL;

      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows > 0 THEN
        RAISE LOG '💰 [BOT-LOOP] Leilão "%" finalizado - preço máximo R$% (bot vencedor)', v_auction.title, v_auction.max_price;
      END IF;
      CONTINUE;
    END IF;

    -- =============================================
    -- FINALIZAÇÃO POR META DE RECEITA
    -- =============================================
    IF v_auction.company_revenue >= v_auction.revenue_target THEN
      SELECT public.get_random_bot() INTO v_bot_user_id;
      IF v_bot_user_id IS NOT NULL THEN
        SELECT full_name, city, state INTO v_winner_name, v_winner_city, v_winner_state
        FROM profiles WHERE user_id = v_bot_user_id;
        
        IF v_winner_city IS NOT NULL AND v_winner_state IS NOT NULL THEN
          v_winner_name := v_winner_name || ' - ' || v_winner_city || ', ' || v_winner_state;
        END IF;

        v_name_parts := string_to_array(trim(COALESCE((SELECT full_name FROM profiles WHERE user_id = v_bot_user_id), 'Bot')), ' ');
        IF array_length(v_name_parts, 1) >= 2 THEN
          v_bot_display := v_name_parts[1] || ' ' || v_name_parts[2];
        ELSE
          v_bot_display := v_name_parts[1];
        END IF;
        v_current_bidders := COALESCE((SELECT last_bidders FROM auctions WHERE id = v_auction.id), '[]'::jsonb);
        v_current_bidders := (to_jsonb(v_bot_display) || v_current_bidders);
        IF jsonb_array_length(v_current_bidders) > 3 THEN
          v_current_bidders := (SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY t(elem, ord) ORDER BY ord LIMIT 3) sub);
        END IF;
      END IF;

      UPDATE auctions SET status = 'finished', finished_at = v_current_time,
        winner_id = v_bot_user_id, winner_name = v_winner_name,
        last_bidders = COALESCE(v_current_bidders, last_bidders),
        finish_reason = 'revenue_target'
      WHERE id = v_auction.id AND status = 'active' AND finished_at IS NULL;

      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows > 0 THEN
        RAISE LOG '🎯 [BOT-LOOP] Leilão "%" finalizado - meta de receita atingida (bot vencedor)', v_auction.title;
      END IF;
      CONTINUE;
    END IF;

    -- =============================================
    -- SAFETY NET: FINALIZAÇÃO POR INATIVIDADE (>= 20s)
    -- =============================================
    IF v_seconds_since_last_bid >= 20 THEN
      SELECT public.get_random_bot() INTO v_bot_user_id;
      IF v_bot_user_id IS NOT NULL THEN
        SELECT full_name, city, state INTO v_winner_name, v_winner_city, v_winner_state
        FROM profiles WHERE user_id = v_bot_user_id;
        
        IF v_winner_city IS NOT NULL AND v_winner_state IS NOT NULL THEN
          v_winner_name := v_winner_name || ' - ' || v_winner_city || ', ' || v_winner_state;
        END IF;

        v_name_parts := string_to_array(trim(COALESCE((SELECT full_name FROM profiles WHERE user_id = v_bot_user_id), 'Bot')), ' ');
        IF array_length(v_name_parts, 1) >= 2 THEN
          v_bot_display := v_name_parts[1] || ' ' || v_name_parts[2];
        ELSE
          v_bot_display := v_name_parts[1];
        END IF;
        v_current_bidders := COALESCE((SELECT last_bidders FROM auctions WHERE id = v_auction.id), '[]'::jsonb);
        v_current_bidders := (to_jsonb(v_bot_display) || v_current_bidders);
        IF jsonb_array_length(v_current_bidders) > 3 THEN
          v_current_bidders := (SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY t(elem, ord) ORDER BY ord LIMIT 3) sub);
        END IF;
      END IF;

      UPDATE auctions SET status = 'finished', finished_at = v_current_time,
        winner_id = v_bot_user_id, winner_name = v_winner_name,
        last_bidders = COALESCE(v_current_bidders, last_bidders),
        finish_reason = 'inactivity_forced'
      WHERE id = v_auction.id AND status = 'active' AND finished_at IS NULL;

      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows > 0 THEN
        RAISE LOG '🚨 [BOT-LOOP] Leilão "%" finalizado por INATIVIDADE (%s sem lance)', v_auction.title, v_seconds_since_last_bid;
      END IF;
      CONTINUE;
    END IF;

    -- =============================================
    -- LANCE DE BOT PROBABILÍSTICO (>= 8s: 100%, >= 6s: 50%)
    -- =============================================
    IF v_seconds_since_last_bid >= 8 THEN
      v_bid_probability := 1.0;
    ELSIF v_seconds_since_last_bid >= 6 THEN
      v_bid_probability := 0.5;
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
        SELECT public.get_random_bot() INTO v_bot_user_id;
        IF v_bot_user_id IS NOT NULL THEN
          SELECT full_name, city, state INTO v_winner_name, v_winner_city, v_winner_state
          FROM profiles WHERE user_id = v_bot_user_id;
          
          IF v_winner_city IS NOT NULL AND v_winner_state IS NOT NULL THEN
            v_winner_name := v_winner_name || ' - ' || v_winner_city || ', ' || v_winner_state;
          END IF;

          v_name_parts := string_to_array(trim(COALESCE((SELECT full_name FROM profiles WHERE user_id = v_bot_user_id), 'Bot')), ' ');
          IF array_length(v_name_parts, 1) >= 2 THEN
            v_bot_display := v_name_parts[1] || ' ' || v_name_parts[2];
          ELSE
            v_bot_display := v_name_parts[1];
          END IF;
          v_current_bidders := COALESCE((SELECT last_bidders FROM auctions WHERE id = v_auction.id), '[]'::jsonb);
          v_current_bidders := (to_jsonb(v_bot_display) || v_current_bidders);
          IF jsonb_array_length(v_current_bidders) > 3 THEN
            v_current_bidders := (SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY t(elem, ord) ORDER BY ord LIMIT 3) sub);
          END IF;
        END IF;

        UPDATE auctions SET status = 'finished', finished_at = v_current_time,
          winner_id = v_bot_user_id, winner_name = v_winner_name,
          last_bidders = COALESCE(v_current_bidders, last_bidders),
          finish_reason = 'loss_protection'
        WHERE id = v_auction.id AND status = 'active' AND finished_at IS NULL;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows > 0 THEN
          RAISE LOG '💰 [BOT-LOOP] Leilão "%" finalizado - prejuízo evitado R$% > R$% (bot vencedor)', v_auction.title, v_auction.current_price, v_auction.market_value;
        END IF;
      ELSE
        RAISE LOG '🤖 [BOT-LOOP] Bot reaqueceu "%" - R$%', v_auction.title, v_new_price;
      END IF;
    END IF;

  END LOOP;

  RAISE LOG '✅ [BOT-LOOP] Passagem concluída';
END;
$$;
