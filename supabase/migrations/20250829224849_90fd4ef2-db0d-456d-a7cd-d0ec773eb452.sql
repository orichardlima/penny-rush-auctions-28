-- CORREÇÃO DEFINITIVA DO CRONÔMETRO
-- Remove triggers conflitantes e limpa sistema para usar apenas time_left

-- 1. REMOVER TRIGGERS CONFLITANTES
DROP TRIGGER IF EXISTS auction_set_end_time_trigger ON public.auctions;
DROP TRIGGER IF EXISTS update_auction_stats_simple_trigger ON public.bids;

-- 2. RECRIAR FUNÇÃO update_auction_stats_simple SEM ends_at
CREATE OR REPLACE FUNCTION public.update_auction_stats_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  brazil_now timestamptz;
  is_bot_user boolean := false;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  IF is_bot_user THEN
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,  -- APENAS time_left, SEM ends_at
      updated_at = brazil_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT] Lance bot no leilão %: timer reset para 15s (APENAS time_left)', NEW.auction_id;
  ELSE
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      time_left = 15,  -- APENAS time_left, SEM ends_at
      updated_at = brazil_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: timer reset para 15s (APENAS time_left), receita +R$%.2f', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. RECRIAR TRIGGER update_auction_stats_simple_trigger
CREATE TRIGGER update_auction_stats_simple_trigger
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auction_stats_simple();

-- 4. LIMPAR ends_at DE TODOS OS LEILÕES ATIVOS
UPDATE public.auctions 
SET 
  ends_at = NULL,
  updated_at = timezone('America/Sao_Paulo', now())
WHERE status = 'active';

-- 5. LOG DE CONFIRMAÇÃO
DO $$
DECLARE
  active_auctions_count integer;
  waiting_auctions_count integer;
BEGIN
  SELECT COUNT(*) INTO active_auctions_count FROM public.auctions WHERE status = 'active';
  SELECT COUNT(*) INTO waiting_auctions_count FROM public.auctions WHERE status = 'waiting';
  
  RAISE LOG '🔧 [CRONOMETER-DEFINITIVE-FIX] Correção definitiva aplicada:';
  RAISE LOG '   ✅ Trigger auction_set_end_time_trigger REMOVIDO';
  RAISE LOG '   ✅ Função update_auction_stats_simple ATUALIZADA (sem ends_at)';
  RAISE LOG '   ✅ ends_at limpo para % leilões ativos', active_auctions_count;
  RAISE LOG '   ✅ % leilões aguardando (não afetados)', waiting_auctions_count;
  RAISE LOG '   🎯 Sistema usando APENAS time_left decrementado pelo cron sync-timers-and-protection';
  RAISE LOG '   🎯 Cronômetros devem funcionar: 15s → 14s → 13s → ... → 0s';
END $$;