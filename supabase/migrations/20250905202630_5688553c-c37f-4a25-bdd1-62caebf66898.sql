-- Remove ends_at dependency from update_auction_on_bid function
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
    -- Bot bid: update price, bids and RESET TIMER (no ends_at)
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT] Lance bot no leilão %: timer resetado para 15s', NEW.auction_id;
  ELSE
    -- User bid: update everything including revenue and RESET TIMER (no ends_at)
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      time_left = 15,
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: receita +R$%.2f, timer resetado para 15s', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Clean inconsistent ends_at state for active auctions
UPDATE public.auctions 
SET ends_at = NULL 
WHERE status = 'active';

-- Log cleanup
DO $$
BEGIN
  RAISE LOG '🧹 [CLEANUP] Removidas dependências de ends_at - timer agora usa apenas time_left';
END $$;