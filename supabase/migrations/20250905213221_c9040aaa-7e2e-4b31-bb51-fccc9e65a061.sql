-- Remover tabela auction_timers (desnecessária na nova arquitetura)
DROP TABLE IF EXISTS public.auction_timers;

-- Atualizar função update_auction_on_bid para diferenciar tipos de bots
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  is_bot_user boolean := false;
  is_n8n_bot boolean := false;
  current_time_br timestamp with time zone;
BEGIN
  current_time_br := timezone('America/Sao_Paulo', now());
  
  -- Identificar tipo de usuário/bot
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  -- Identificar bots N8N (bids com cost_paid = 0 mas is_bot = false)
  -- Assumindo que bots N8N fazem bids com cost_paid > 0 mas vem de webhook
  is_n8n_bot := NOT is_bot_user AND NEW.cost_paid > 0;
  
  IF is_bot_user THEN
    -- Bot interno: atualiza preço e bids, RESETA TIMER mas NÃO incrementa receita
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT-INTERNO] Lance bot interno no leilão %: timer resetado, SEM incremento de receita', NEW.auction_id;
    
  ELSIF is_n8n_bot THEN
    -- Bot N8N: atualiza preço, bids, RESETA TIMER mas NÃO incrementa receita
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT-N8N] Lance bot N8N no leilão %: timer resetado, SEM incremento de receita', NEW.auction_id;
    
  ELSE
    -- Usuário real: atualiza tudo INCLUINDO receita e RESETA TIMER
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      time_left = 15,
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: receita +R$%.2f, timer resetado', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Remover trigger de inicialização de timer (não precisa mais)
DROP TRIGGER IF EXISTS initialize_auction_timer_trigger ON public.auctions;