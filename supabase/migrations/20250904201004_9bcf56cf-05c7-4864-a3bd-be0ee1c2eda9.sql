-- 🧹 REMOÇÃO COMPLETA DO SISTEMA DE TIMER (Corrigida)
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

-- 6. Log da remoção
SELECT 'Sistema de timer removido do banco de dados' as status;