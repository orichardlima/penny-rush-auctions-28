-- Fix timer reset issue definitively - comprehensive solution
-- Step 1: Improve update_auction_timers function with extended protection and better timezone handling
CREATE OR REPLACE FUNCTION public.update_auction_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auction_record record;
  utc_now timestamptz;
  time_remaining integer;
BEGIN
  -- Use UTC consistently to avoid timezone conflicts
  utc_now := now();
  
  -- Update all active auctions
  FOR auction_record IN 
    SELECT id, time_left, ends_at, updated_at 
    FROM public.auctions 
    WHERE status = 'active'
  LOOP
    -- If auction has time_left but no ends_at, calculate ends_at
    IF auction_record.ends_at IS NULL AND auction_record.time_left IS NOT NULL THEN
      UPDATE public.auctions 
      SET ends_at = utc_now + (auction_record.time_left || ' seconds')::interval,
          updated_at = utc_now
      WHERE id = auction_record.id;
      
      RAISE LOG 'Set ends_at for auction %: % seconds from now', auction_record.id, auction_record.time_left;
    
    -- Extended protection: Only update time_left if auction hasn't been updated in the last 10 seconds
    -- This gives more time for the bid trigger to stabilize
    ELSIF auction_record.ends_at IS NOT NULL 
      AND (utc_now - auction_record.updated_at) > INTERVAL '10 seconds' THEN
      
      -- Calculate time remaining with 1-second safety margin to prevent premature zero
      time_remaining := GREATEST(0, EXTRACT(EPOCH FROM (auction_record.ends_at - utc_now))::integer);
      
      -- Add protection against near-zero calculations that might be precision errors
      IF time_remaining <= 1 AND auction_record.ends_at > utc_now THEN
        time_remaining := 1;
      END IF;
      
      -- Only update if the calculated time is significantly different (more than 1 second difference)
      IF ABS(time_remaining - auction_record.time_left) > 1 THEN
        UPDATE public.auctions 
        SET time_left = time_remaining,
            updated_at = utc_now
        WHERE id = auction_record.id;
        
        RAISE LOG 'Timer update for auction %: % -> % seconds (ends_at: %, now: %)', 
          auction_record.id, auction_record.time_left, time_remaining, auction_record.ends_at, utc_now;
      END IF;
      
      -- If time is truly up (with safety margin), mark as finished
      IF time_remaining = 0 AND auction_record.ends_at <= utc_now THEN
        UPDATE public.auctions 
        SET status = 'finished',
            updated_at = utc_now
        WHERE id = auction_record.id;
        
        RAISE LOG 'Auction % finished - time expired at %', auction_record.id, utc_now;
      END IF;
    
    -- For recently updated auctions (within 10 seconds), just check protection activation
    -- Don't touch the timer as it was just set by a bid
    ELSIF auction_record.ends_at IS NOT NULL THEN
      time_remaining := GREATEST(0, EXTRACT(EPOCH FROM (auction_record.ends_at - utc_now))::integer);
      
      RAISE LOG 'Skipping timer update for recently updated auction % (updated % seconds ago)', 
        auction_record.id, EXTRACT(EPOCH FROM (utc_now - auction_record.updated_at));
      
      -- Activate automatic protection when close to target (80% of revenue)
      IF time_remaining <= 15 AND auction_record.id IN (
        SELECT a.id FROM public.auctions a 
        WHERE a.id = auction_record.id 
        AND a.min_revenue_target > 0
        AND (
          SELECT COALESCE(SUM(cost_paid), 0) FROM public.bids WHERE auction_id = a.id
        ) >= (a.min_revenue_target * 0.8)
        AND a.protected_mode = false
      ) THEN
        UPDATE public.auctions 
        SET protected_mode = true,
            protected_target = min_revenue_target
        WHERE id = auction_record.id;
        
        RAISE LOG 'Protection activated for auction % - revenue close to target', auction_record.id;
      END IF;
    END IF;
  END LOOP;
  
  RAISE LOG 'Timer sync completed at % (UTC)', utc_now;
END;
$$;

-- Step 2: Improve update_auction_stats trigger to ensure consistent 15-second timer
CREATE OR REPLACE FUNCTION public.update_auction_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  utc_now timestamptz;
  new_ends_at timestamptz;
BEGIN
  -- Use UTC consistently
  utc_now := now();
  
  -- Calculate new end time with 16-second buffer to ensure 15 seconds minimum
  new_ends_at := utc_now + INTERVAL '16 seconds';
  
  -- Update auction stats with EXACTLY 15 seconds time_left
  UPDATE public.auctions
  SET 
    total_bids = total_bids + 1,
    current_price = current_price + bid_increment,
    ends_at = new_ends_at,
    time_left = 15, -- ALWAYS exactly 15 seconds
    updated_at = utc_now
  WHERE id = NEW.auction_id;
  
  RAISE LOG 'Bid placed on auction %: timer reset to 15 seconds, ends_at: %, now: %', 
    NEW.auction_id, new_ends_at, utc_now;
  
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