-- Corrigir função get_auction_time_left para lidar com leilões expirados
CREATE OR REPLACE FUNCTION public.get_auction_time_left(auction_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record RECORD;
  seconds_since_last_bid integer;
  time_remaining integer;
  current_time_br timestamp with time zone;
BEGIN
  current_time_br := timezone('America/Sao_Paulo', now());
  
  -- Get auction data
  SELECT id, status, last_bid_at, time_left
  INTO auction_record
  FROM public.auctions
  WHERE id = auction_uuid;
  
  -- Return 0 if auction not found
  IF auction_record.id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Return 0 if auction is not active
  IF auction_record.status != 'active' THEN
    RETURN 0;
  END IF;
  
  -- If no last_bid_at, check if auction is very old (should be finalized)
  IF auction_record.last_bid_at IS NULL THEN
    -- If auction has been active for more than 30 seconds without any bid, consider expired
    RETURN COALESCE(auction_record.time_left, 15);
  END IF;
  
  -- Calculate seconds since last bid
  SELECT EXTRACT(EPOCH FROM (current_time_br - auction_record.last_bid_at))::integer
  INTO seconds_since_last_bid;
  
  -- If more than 30 seconds since last bid, auction should be finalized
  -- Return -1 as a signal that auction needs finalization
  IF seconds_since_last_bid > 30 THEN
    RETURN -1;
  END IF;
  
  -- Calculate remaining time (15 seconds timer)
  time_remaining := 15 - seconds_since_last_bid;
  
  -- Ensure non-negative result, but allow small negative values for grace period
  IF time_remaining < -5 THEN
    RETURN -1; -- Signal for finalization
  END IF;
  
  RETURN GREATEST(time_remaining, 0);
END;
$function$;