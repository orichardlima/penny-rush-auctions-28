
-- =============================================
-- ETAPA 1: Adicionar 3 colunas à tabela auctions
-- =============================================
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS scheduled_bot_bid_at timestamptz DEFAULT NULL;
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS scheduled_bot_band text DEFAULT NULL;
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS last_bot_band text DEFAULT NULL;

-- =============================================
-- ETAPA 2: Recriar trigger update_auction_on_bid()
-- Adiciona invalidação de agendamento a cada novo lance
-- =============================================
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_bid_increment NUMERIC;
  v_bid_cost NUMERIC;
  v_full_name TEXT;
  v_display_name TEXT;
  v_name_parts TEXT[];
  v_current_bidders JSONB;
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
  
  SELECT full_name INTO v_full_name 
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  IF v_full_name IS NOT NULL AND v_full_name != '' AND v_full_name != 'Usuário' THEN
    v_name_parts := string_to_array(trim(v_full_name), ' ');
    IF array_length(v_name_parts, 1) >= 2 THEN
      v_display_name := v_name_parts[1] || ' ' || v_name_parts[2];
    ELSIF array_length(v_name_parts, 1) = 1 THEN
      v_display_name := v_name_parts[1];
    ELSE
      v_display_name := 'Usuário';
    END IF;
  ELSE
    v_display_name := 'Usuário';
  END IF;
  
  v_current_bidders := COALESCE(v_auction.last_bidders, '[]'::jsonb);
  v_current_bidders := (to_jsonb(v_display_name) || v_current_bidders);
  IF jsonb_array_length(v_current_bidders) > 3 THEN
    v_current_bidders := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord
        LIMIT 3
      ) sub
    );
  END IF;
  
  -- ATUALIZAÇÃO: inclui invalidação de agendamento pendente
  UPDATE public.auctions 
  SET 
    current_price = COALESCE(current_price, COALESCE(starting_price, 0)) + v_bid_increment,
    total_bids = COALESCE(total_bids, 0) + 1,
    company_revenue = COALESCE(company_revenue, 0) + 
      CASE WHEN NEW.cost_paid > 0 AND NOT v_is_bot THEN v_bid_cost ELSE 0 END,
    time_left = 15,
    last_bid_at = NOW(),
    last_bidders = v_current_bidders,
    updated_at = NOW(),
    scheduled_bot_bid_at = NULL,
    scheduled_bot_band = NULL
  WHERE id = NEW.auction_id;
  
  RETURN NEW;
END;
$$;

-- =============================================
-- ETAPA 3: Recriar bot_protection_loop com agendamento
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
    -- SAFETY NET: INATIVIDADE >= 40s
    -- =============================================
    IF v_seconds_since_last_bid >= 40 THEN
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
  
  RAISE LOG '✅ [BOT-LOOP] Passagem concluída';
END;
$$;

-- =============================================
-- HELPER: Finalizar leilão com bot (reduz duplicação)
-- =============================================
CREATE OR REPLACE FUNCTION public._bot_finalize_auction(
  p_auction_id uuid,
  p_title text,
  p_finish_reason text,
  p_current_time timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bot_user_id uuid;
  v_winner_name text;
  v_winner_city text;
  v_winner_state text;
  v_bot_display text;
  v_name_parts text[];
  v_current_bidders jsonb;
  v_rows integer;
BEGIN
  SELECT public.get_random_bot() INTO v_bot_user_id;
  IF v_bot_user_id IS NULL THEN
    RAISE LOG '❌ [BOT-FINALIZE] Nenhum bot disponível para "%"', p_title;
    RETURN;
  END IF;

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

  v_current_bidders := COALESCE((SELECT last_bidders FROM auctions WHERE id = p_auction_id), '[]'::jsonb);
  v_current_bidders := (to_jsonb(v_bot_display) || v_current_bidders);
  IF jsonb_array_length(v_current_bidders) > 3 THEN
    v_current_bidders := (SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY t(elem, ord) ORDER BY ord LIMIT 3) sub);
  END IF;

  UPDATE auctions SET
    status = 'finished',
    finished_at = p_current_time,
    winner_id = v_bot_user_id,
    winner_name = v_winner_name,
    last_bidders = v_current_bidders,
    finish_reason = p_finish_reason,
    scheduled_bot_bid_at = NULL,
    scheduled_bot_band = NULL
  WHERE id = p_auction_id AND status = 'active' AND finished_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    RAISE LOG '🏁 [BOT-FINALIZE] "%" | reason=% | bot=%', p_title, p_finish_reason, v_winner_name;
  END IF;
END;
$$;
