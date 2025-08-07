-- Remove duplicate trigger (keep only the original one)
DROP TRIGGER IF EXISTS update_auction_stats_trigger ON public.bids;

-- Verify the update_auction_stats function increments correctly (1 cent per bid)
CREATE OR REPLACE FUNCTION public.update_auction_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Update total of bids, price and set new ends_at
  UPDATE public.auctions
  SET 
    total_bids = total_bids + 1,
    current_price = current_price + bid_increment, -- This should be 1 cent
    ends_at = NOW() + INTERVAL '15 seconds',
    time_left = 15, -- Reset to 15 seconds
    updated_at = now()
  WHERE id = NEW.auction_id;
  
  -- If auction reached protection target, disable protection
  UPDATE public.auctions
  SET protected_mode = false
  WHERE id = NEW.auction_id 
    AND protected_mode = true
    AND protected_target > 0
    AND (
      SELECT COALESCE(SUM(cost_paid), 0)
      FROM public.bids
      WHERE auction_id = NEW.auction_id
    ) >= protected_target;
  
  RETURN NEW;
END;
$function$;

-- Fix current auction data by recalculating based on actual bids
UPDATE public.auctions 
SET 
  total_bids = (
    SELECT COUNT(*) 
    FROM public.bids 
    WHERE auction_id = auctions.id
  ),
  current_price = starting_price + (
    SELECT COUNT(*) * bid_increment
    FROM public.bids 
    WHERE auction_id = auctions.id
  )
WHERE status = 'active';