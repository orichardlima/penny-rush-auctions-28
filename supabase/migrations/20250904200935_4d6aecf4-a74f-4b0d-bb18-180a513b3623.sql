-- 🧹 REMOÇÃO COMPLETA DO SISTEMA DE TIMER
-- Remover todas as colunas, funções e triggers relacionados a timer

-- 1. Remover triggers relacionados a timer
DROP TRIGGER IF EXISTS update_auction_stats ON public.bids;
DROP TRIGGER IF EXISTS update_auction_stats_simple ON public.bids;
DROP TRIGGER IF EXISTS set_auction_end_time ON public.auctions;

-- 2. Remover funções relacionadas a timer
DROP FUNCTION IF EXISTS public.update_auction_stats() CASCADE;
DROP FUNCTION IF EXISTS public.update_auction_stats_simple() CASCADE;
DROP FUNCTION IF EXISTS public.set_auction_end_time() CASCADE;
DROP FUNCTION IF EXISTS public.sync_auction_timers_visual() CASCADE;
DROP FUNCTION IF EXISTS public.finalize_auctions_by_inactivity() CASCADE;

-- 3. Remover colunas de timer da tabela auctions
ALTER TABLE public.auctions 
DROP COLUMN IF EXISTS time_left,
DROP COLUMN IF EXISTS timer_start_time,
DROP COLUMN IF EXISTS duration,
DROP COLUMN IF EXISTS ends_at;

-- 4. Criar nova função simplificada para atualizar leilões (sem timer)
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
RETURNS TRIGGER AS $$
DECLARE
  is_bot_user boolean := false;
BEGIN
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  IF is_bot_user THEN
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      updated_at = timezone('America/Sao_Paulo', now())
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT] Lance bot no leilão %: sem timer', NEW.auction_id;
  ELSE
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      updated_at = timezone('America/Sao_Paulo', now())
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: receita +R$%.2f', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 5. Criar trigger para a nova função
CREATE TRIGGER update_auction_on_bid
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auction_on_bid();

-- 6. Atualizar função de finalização (sem timer)
CREATE OR REPLACE FUNCTION public.finalize_auction_by_inactivity()
RETURNS TRIGGER AS $$
DECLARE
  last_bid_time TIMESTAMPTZ;
  brazil_now TIMESTAMPTZ;
  seconds_since_last_bid INTEGER;
  winner_user_id UUID;
  winner_display_name TEXT;
  winner_city TEXT;
  winner_state TEXT;
BEGIN
  -- Só processar leilões ativos
  IF NEW.status != 'active' OR OLD.status != 'active' THEN
    RETURN NEW;
  END IF;
  
  brazil_now := timezone('America/Sao_Paulo', now());
  
  -- Buscar último lance
  SELECT MAX(b.created_at) INTO last_bid_time
  FROM public.bids b
  WHERE b.auction_id = NEW.id;
  
  -- Se não há lances, usar updated_at
  IF last_bid_time IS NULL THEN
    last_bid_time := NEW.updated_at;
  END IF;
  
  -- Calcular inatividade
  seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - last_bid_time))::integer;
  
  -- Finalizar se inativo por 15+ segundos
  IF seconds_since_last_bid >= 15 THEN
    -- Buscar ganhador
    SELECT b.user_id, p.full_name, p.city, p.state
    INTO winner_user_id, winner_display_name, winner_city, winner_state
    FROM public.bids b
    LEFT JOIN public.profiles p ON b.user_id = p.user_id
    WHERE b.auction_id = NEW.id
    ORDER BY b.created_at DESC
    LIMIT 1;
    
    -- Definir nome do ganhador
    IF winner_display_name IS NOT NULL AND trim(winner_display_name) != '' THEN
      IF winner_city IS NOT NULL AND winner_state IS NOT NULL AND 
         trim(winner_city) != '' AND trim(winner_state) != '' THEN
        winner_display_name := winner_display_name || ' - ' || winner_city || ', ' || winner_state;
      END IF;
    ELSIF winner_user_id IS NOT NULL THEN
      winner_display_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
    ELSE
      winner_display_name := 'Nenhum ganhador';
      winner_user_id := NULL;
    END IF;
    
    -- Finalizar leilão
    NEW.status := 'finished';
    NEW.winner_id := winner_user_id;
    NEW.winner_name := winner_display_name;
    NEW.finished_at := brazil_now;
    NEW.updated_at := brazil_now;
    
    RAISE LOG '✅ [FINALIZED] Leilão "%" finalizado! Ganhador: "%"', NEW.title, winner_display_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7. Remover todos os cron jobs relacionados a timer
SELECT cron.unschedule('timer-sync-essential');
SELECT cron.unschedule('finalize-auctions-by-inactivity');
SELECT cron.unschedule('revenue-protection-critical');
SELECT cron.unschedule('sync-timers-and-protection');

-- 8. Log da remoção
SELECT 'Sistema de timer completamente removido' as status;