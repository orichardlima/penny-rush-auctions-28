-- 1. Corrigir o trigger update_auction_on_bid() para usar now() diretamente
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  is_bot_user boolean := false;
BEGIN
  -- Identificar se é bot (interno)
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  -- Verificar se é bot N8N ou bot interno
  IF is_bot_user OR NEW.cost_paid = 0 THEN
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,
      last_bid_at = now(),
      updated_at = now()
    WHERE id = NEW.auction_id;
    
    IF is_bot_user THEN
      RAISE LOG '🤖 [BID-BOT-INTERNO] Bot interno no leilão %: preço atualizado, timer resetado, SEM receita', NEW.auction_id;
    ELSE
      RAISE LOG '🤖 [BID-BOT-N8N] Bot N8N no leilão %: preço atualizado, timer resetado, SEM receita', NEW.auction_id;
    END IF;
    
  ELSE
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + NEW.cost_paid,
      time_left = 15,
      last_bid_at = now(),
      updated_at = now()
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Usuário real no leilão %: receita +R$%.2f, preço e timer atualizados', NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Corrigir dados existentes nos leilões ativos (adicionar 3 horas ao last_bid_at incorreto)
UPDATE public.auctions 
SET last_bid_at = last_bid_at + interval '3 hours'
WHERE status = 'active' 
AND last_bid_at IS NOT NULL;