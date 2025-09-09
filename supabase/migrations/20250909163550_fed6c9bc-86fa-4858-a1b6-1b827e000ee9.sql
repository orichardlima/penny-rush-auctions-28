-- Add last_bid_at field to auctions table for proper timer synchronization
ALTER TABLE public.auctions 
ADD COLUMN last_bid_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing auctions to have last_bid_at based on their latest bid
UPDATE public.auctions 
SET last_bid_at = (
  SELECT MAX(b.created_at) 
  FROM public.bids b 
  WHERE b.auction_id = auctions.id
)
WHERE EXISTS (
  SELECT 1 FROM public.bids b WHERE b.auction_id = auctions.id
);

-- Create function to calculate real-time remaining based on last_bid_at
CREATE OR REPLACE FUNCTION public.get_auction_time_left(auction_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  auction_record RECORD;
  seconds_since_last_bid integer;
  time_remaining integer;
BEGIN
  -- Get auction data
  SELECT id, status, last_bid_at, time_left
  INTO auction_record
  FROM public.auctions
  WHERE id = auction_uuid;
  
  -- Return 0 if auction not found or not active
  IF auction_record.id IS NULL OR auction_record.status != 'active' THEN
    RETURN 0;
  END IF;
  
  -- If no last_bid_at, use current time_left
  IF auction_record.last_bid_at IS NULL THEN
    RETURN COALESCE(auction_record.time_left, 15);
  END IF;
  
  -- Calculate seconds since last bid
  SELECT EXTRACT(EPOCH FROM (timezone('America/Sao_Paulo', now()) - auction_record.last_bid_at))::integer
  INTO seconds_since_last_bid;
  
  -- Calculate remaining time (15 seconds timer)
  time_remaining := 15 - seconds_since_last_bid;
  
  -- Ensure non-negative result
  RETURN GREATEST(time_remaining, 0);
END;
$$;

-- Update the bid processing function to always set last_bid_at
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
      last_bid_at = current_time_br,  -- CRÍTICO: sempre atualizar last_bid_at
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Usuário real no leilão %: receita +R$%.2f, preço e timer atualizados', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$$;