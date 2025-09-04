-- Adicionar colunas de timer na tabela auctions
ALTER TABLE public.auctions 
ADD COLUMN time_left INTEGER DEFAULT 15,
ADD COLUMN ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Atualizar trigger para resetar timer a cada lance
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  is_bot_user boolean := false;
BEGIN
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
      ends_at = timezone('America/Sao_Paulo', now()) + INTERVAL '15 seconds',
      updated_at = timezone('America/Sao_Paulo', now())
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT] Lance bot no leilão %: timer resetado para 15s', NEW.auction_id;
  ELSE
    -- Lance de usuário: atualiza tudo incluindo receita e RESETA TIMER  
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      time_left = 15,  -- Reset timer para 15 segundos
      ends_at = timezone('America/Sao_Paulo', now()) + INTERVAL '15 seconds',
      updated_at = timezone('America/Sao_Paulo', now())
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: receita +R$%.2f, timer resetado', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Garantir que leilões ativos iniciem com timer ativo
UPDATE public.auctions 
SET 
  time_left = 15,
  ends_at = timezone('America/Sao_Paulo', now()) + INTERVAL '15 seconds'
WHERE status = 'active' AND (time_left IS NULL OR time_left <= 0);

-- Função para decrementar timers automaticamente
CREATE OR REPLACE FUNCTION public.decrement_auction_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  affected_count integer := 0;
BEGIN
  -- Decrementar timer de todos os leilões ativos
  UPDATE public.auctions 
  SET 
    time_left = GREATEST(time_left - 1, 0),
    updated_at = timezone('America/Sao_Paulo', now())
  WHERE status = 'active' 
    AND time_left > 0;
    
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  IF affected_count > 0 THEN
    RAISE LOG '⏰ [TIMER-TICK] Decrementado timer de % leilões ativos', affected_count;
  END IF;
  
  -- Finalizar leilões com timer zerado (sem atividade por 15+ segundos)
  UPDATE public.auctions
  SET 
    status = 'finished',
    finished_at = timezone('America/Sao_Paulo', now()),
    winner_id = (
      SELECT user_id 
      FROM public.bids 
      WHERE auction_id = auctions.id 
      ORDER BY created_at DESC 
      LIMIT 1
    ),
    winner_name = (
      SELECT p.full_name 
      FROM public.bids b
      JOIN public.profiles p ON b.user_id = p.user_id
      WHERE b.auction_id = auctions.id 
      ORDER BY b.created_at DESC 
      LIMIT 1
    )
  WHERE status = 'active' 
    AND time_left <= 0;
    
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  IF affected_count > 0 THEN
    RAISE LOG '🏁 [TIMER-FINISH] Finalizados % leilões por timer zerado', affected_count;
  END IF;
END;
$function$;