-- Corrigir função update_auction_on_bid para que TODOS os bots (internos e N8N) não incrementem company_revenue
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  is_bot_user boolean := false;
  current_time_br timestamp with time zone;
BEGIN
  current_time_br := timezone('America/Sao_Paulo', now());
  
  -- Identificar se é bot (interno)
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  -- Verificar se é bot N8N (bids com cost_paid = 0 mas is_bot = false)
  -- OU se é bot interno (is_bot = true)
  IF is_bot_user OR NEW.cost_paid = 0 THEN
    -- QUALQUER TIPO DE BOT: atualiza preço e bids, RESETA TIMER mas NÃO incrementa receita
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    IF is_bot_user THEN
      RAISE LOG '🤖 [BID-BOT-INTERNO] Bot interno no leilão %: preço atualizado, timer resetado, SEM receita', NEW.auction_id;
    ELSE
      RAISE LOG '🤖 [BID-BOT-N8N] Bot N8N no leilão %: preço atualizado, timer resetado, SEM receita', NEW.auction_id;
    END IF;
    
  ELSE
    -- Usuário real: atualiza tudo INCLUINDO receita e RESETA TIMER
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + NEW.cost_paid,
      time_left = 15,
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Usuário real no leilão %: receita +R$%.2f, preço e timer atualizados', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;