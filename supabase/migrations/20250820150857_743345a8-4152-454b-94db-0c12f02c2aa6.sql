-- SOLUÇÃO DEFINITIVA: Sistema robusto que evita deadlocks permanentemente

-- 1. Bots atuam entre 2-5 segundos (mais natural e evita conflitos com finalização)
CREATE OR REPLACE PROCEDURE public.auto_bid_system_procedure()
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  auction_record record;
  current_revenue integer;
  revenue_percentage decimal;
  bot_id uuid;
  seconds_since_last_bid integer;
  brazil_now timestamptz;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  FOR auction_record IN 
    SELECT 
      a.id,
      a.time_left,
      a.revenue_target,
      a.current_price,
      a.bid_increment,
      a.bid_cost,
      a.market_value,
      a.title,
      a.updated_at
    FROM public.auctions a
    WHERE a.status = 'active' 
      AND a.time_left BETWEEN 2 AND 5  -- Janela segura: 2-5 segundos
      AND a.revenue_target > 0
  LOOP
    
    -- Verificar há quanto tempo não há atividade
    seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - auction_record.updated_at))::integer;
    
    -- Só atuar se há pelo menos 2 segundos de inatividade (evita conflitos)
    IF seconds_since_last_bid >= 2 THEN
      
      SELECT public.get_auction_revenue(auction_record.id) INTO current_revenue;
      revenue_percentage := (current_revenue::decimal / auction_record.revenue_target::decimal) * 100;
      
      RAISE LOG '🤖 [BOT-SAFE] Leilão %: timer=%s, inativo_por=%ss, receita=%.1f%%', 
        auction_record.id, auction_record.time_left, seconds_since_last_bid, revenue_percentage;
      
      -- Condições para intervenção do bot
      IF revenue_percentage < 80 OR 
         (auction_record.market_value > 0 AND auction_record.current_price < (auction_record.market_value * 0.9)) THEN
        
        SELECT public.get_random_bot() INTO bot_id;
        
        INSERT INTO public.bids (auction_id, user_id, bid_amount, cost_paid)
        VALUES (auction_record.id, bot_id, auction_record.current_price + auction_record.bid_increment, auction_record.bid_cost);
        
        RAISE LOG '✅ [BOT-SAFE] Bot executou lance: leilão=%, timer=%s, inativo=%ss', 
          auction_record.id, auction_record.time_left, seconds_since_last_bid;
      ELSE
        RAISE LOG '⏭️ [BOT-SAFE] Leilão % não precisa de intervenção (meta OK)', auction_record.id;
      END IF;
      
    ELSE
      RAISE LOG '⏰ [BOT-SAFE] Leilão %: aguardando inatividade (apenas %s de %ss necessários)', 
        auction_record.id, seconds_since_last_bid, 2;
    END IF;
  END LOOP;
  
  RAISE LOG '🏁 [BOT-SAFE] Verificação segura concluída';
END;
$$;

-- 2. Sistema de finalização mais robusto 
CREATE OR REPLACE FUNCTION public.finalize_expired_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  auction_record RECORD;
  winner_user_id UUID;
  winner_display_name TEXT;
  brazil_now TIMESTAMPTZ;
  last_bid_time TIMESTAMPTZ;
  seconds_since_last_bid INTEGER;
  current_revenue INTEGER;
  revenue_percentage DECIMAL;
  finalized_count INTEGER := 0;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🔍 [FINALIZE-SAFE] Verificando leilões para finalização às % (BR)', brazil_now;
  
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title, 
      a.updated_at,
      a.revenue_target,
      a.market_value,
      a.current_price,
      a.time_left
    FROM public.auctions a
    WHERE a.status = 'active'
      AND a.time_left <= 0  -- Só finalizar leilões com timer zerado
  LOOP
    
    -- Buscar último lance real (não apenas updated_at)
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = auction_record.id;
    
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
    END IF;
    
    seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - last_bid_time))::integer;
    
    RAISE LOG '📊 [FINALIZE-SAFE] Leilão "%": timer=%s, inativo=%ss', 
      auction_record.title, auction_record.time_left, seconds_since_last_bid;
    
    -- FINALIZAR APENAS se: timer=0 E 20+ segundos sem lances (margem de segurança)
    IF seconds_since_last_bid >= 20 THEN
      
      -- Buscar ganhador
      SELECT b.user_id, p.full_name
      INTO winner_user_id, winner_display_name
      FROM public.bids b
      LEFT JOIN public.profiles p ON b.user_id = p.user_id
      WHERE b.auction_id = auction_record.id
      ORDER BY b.created_at DESC
      LIMIT 1;
      
      IF winner_display_name IS NOT NULL AND trim(winner_display_name) != '' THEN
        winner_display_name := winner_display_name;
      ELSIF winner_user_id IS NOT NULL THEN
        winner_display_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
      ELSE
        winner_display_name := 'Nenhum ganhador';
        winner_user_id := NULL;
      END IF;
      
      -- FINALIZAR LEILÃO
      UPDATE public.auctions
      SET 
        status = 'finished',
        time_left = 0,
        winner_id = winner_user_id,
        winner_name = winner_display_name,
        finished_at = brazil_now,
        updated_at = brazil_now
      WHERE id = auction_record.id;
      
      finalized_count := finalized_count + 1;
      
      RAISE LOG '✅ [FINALIZE-SAFE] Leilão "%" finalizado! Ganhador: "%" (%s inativo)', 
        auction_record.title, winner_display_name, seconds_since_last_bid;
        
    ELSE
      RAISE LOG '⏰ [FINALIZE-SAFE] Leilão "%" ainda ativo - apenas %s de %ss necessários', 
        auction_record.title, seconds_since_last_bid, 20;
    END IF;
      
  END LOOP;
  
  RAISE LOG '🔚 [FINALIZE-SAFE] Finalização segura concluída: % leilões finalizados às % (BR)', 
    finalized_count, brazil_now;
END;
$$;

-- 3. Restaurar proteção normal (sem exceções para bots em timer=0)
CREATE OR REPLACE FUNCTION public.prevent_bids_on_inactive_auctions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

  -- REGRA ÚNICA E SIMPLES: Só lances em leilões ativos com timer > 0
  IF a.status <> 'active' OR 
     (a.ends_at IS NOT NULL AND a.ends_at <= timezone('America/Sao_Paulo', now())) OR 
     COALESCE(a.time_left, 0) <= 0 THEN
    RAISE EXCEPTION 'Cannot place bids on inactive or finished auctions';
  END IF;

  RETURN NEW;
END;
$$;