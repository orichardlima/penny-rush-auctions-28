-- Fix ends_at for active auction and improve bid validation
UPDATE public.auctions 
SET 
  ends_at = timezone('America/Sao_Paulo', now()) + INTERVAL '15 seconds',
  time_left = 15,
  updated_at = timezone('America/Sao_Paulo', now())
WHERE status = 'active' AND id = 'b18e86cb-a55c-4741-8613-2dae6d2478bc';

-- Improve bid validation to be more tolerant with timing
CREATE OR REPLACE FUNCTION public.prevent_bids_on_inactive_auctions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  a RECORD;
  current_time_br timestamp with time zone;
BEGIN
  current_time_br := timezone('America/Sao_Paulo', now());
  
  SELECT id, status, ends_at, time_left INTO a
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  -- Only reject if auction is clearly inactive - add 5 second tolerance window
  IF a.status <> 'active' OR 
     (a.ends_at IS NOT NULL AND a.ends_at < current_time_br - INTERVAL '5 seconds') OR 
     COALESCE(a.time_left, 0) < -5 THEN
    RAISE EXCEPTION 'Cannot place bids on inactive or finished auctions';
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure update_auction_on_bid trigger is working correctly
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
  
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  IF is_bot_user THEN
    -- Bot bid: update price, bids and RESET TIMER
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,
      ends_at = current_time_br + INTERVAL '15 seconds',
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT] Lance bot no leilão %: timer e ends_at resetados', NEW.auction_id;
  ELSE
    -- User bid: update everything including revenue and RESET TIMER  
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      time_left = 15,
      ends_at = current_time_br + INTERVAL '15 seconds',
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: receita +R$%.2f, timer e ends_at resetados', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;