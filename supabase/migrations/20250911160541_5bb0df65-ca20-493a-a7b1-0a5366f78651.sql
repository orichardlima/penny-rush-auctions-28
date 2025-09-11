-- Corrigir leilões ativos existentes - atualizar last_bid_at para o lance mais recente
UPDATE public.auctions
SET 
  last_bid_at = (
    SELECT MAX(b.created_at)
    FROM public.bids b
    WHERE b.auction_id = auctions.id
  ),
  updated_at = timezone('America/Sao_Paulo', now())
WHERE status = 'active'
  AND id IN (
    SELECT DISTINCT auction_id 
    FROM public.bids
  );

-- Modificar a função update_auction_on_bid para SEMPRE atualizar last_bid_at
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
      last_bid_at = current_time_br,  -- CRÍTICO: sempre atualizar last_bid_at
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    IF is_bot_user THEN
      RAISE LOG '🤖 [BID-BOT-INTERNO] Bot interno no leilão %: preço atualizado, timer resetado, last_bid_at=%, SEM receita', 
        NEW.auction_id, current_time_br;
    ELSE
      RAISE LOG '🤖 [BID-BOT-N8N] Bot N8N no leilão %: preço atualizado, timer resetado, last_bid_at=%, SEM receita', 
        NEW.auction_id, current_time_br;
    END IF;
    
  ELSE
    -- Usuário real: atualiza tudo INCLUINDO receita e RESETA TIMER
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + NEW.cost_paid,
      time_left = 15,
      last_bid_at = current_time_br,  -- CRÍTICO: sempre atualizar last_bid_at
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Usuário real no leilão %: receita +R$%.2f, last_bid_at=%, preço e timer atualizados', 
      NEW.auction_id, NEW.cost_paid, current_time_br;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Log da operação
RAISE LOG '🔧 [TRIGGER-FIX] Trigger update_auction_on_bid corrigido para sempre atualizar last_bid_at';