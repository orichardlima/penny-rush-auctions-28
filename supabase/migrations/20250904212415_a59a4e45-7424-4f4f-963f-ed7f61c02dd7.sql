-- Corrigir a função para sempre atualizar ends_at junto com time_left
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
  -- Obter horário do Brasil
  current_time_br := timezone('America/Sao_Paulo', now());
  
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  IF is_bot_user THEN
    -- Lance de bot: atualiza preço, bids e RESETA TIMER
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,  -- Reset timer para 15 segundos
      ends_at = current_time_br + INTERVAL '15 seconds',  -- CRUCIAL: Atualizar ends_at
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT] Lance bot no leilão %: timer e ends_at resetados', NEW.auction_id;
  ELSE
    -- Lance de usuário: atualiza tudo incluindo receita e RESETA TIMER  
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      time_left = 15,  -- Reset timer para 15 segundos
      ends_at = current_time_br + INTERVAL '15 seconds',  -- CRUCIAL: Atualizar ends_at
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: receita +R$%.2f, timer e ends_at resetados', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Corrigir o leilão "Sem Timer" que está com ends_at desatualizado
UPDATE public.auctions 
SET 
  ends_at = timezone('America/Sao_Paulo', now()) + INTERVAL '15 seconds'
WHERE title = 'Sem Timer' AND status = 'active';

-- Verificar se foi corrigido
SELECT id, title, status, time_left, 
       ends_at,
       timezone('America/Sao_Paulo', now()) as now_br,
       (ends_at > timezone('America/Sao_Paulo', now())) as is_future
FROM public.auctions 
WHERE title = 'Sem Timer';