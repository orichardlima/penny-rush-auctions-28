-- Fix timer reset issue - prevent update_auction_timers from overwriting time_left when a bid was just placed
CREATE OR REPLACE FUNCTION public.update_auction_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auction_record record;
  brazil_now timestamptz;
  time_remaining integer;
BEGIN
  -- Get current time in Brazil timezone
  brazil_now := timezone('America/Sao_Paulo', now());
  
  -- Update all active auctions
  FOR auction_record IN 
    SELECT id, time_left, ends_at, updated_at 
    FROM public.auctions 
    WHERE status = 'active'
  LOOP
    -- If auction has time_left but no ends_at, calculate ends_at
    IF auction_record.ends_at IS NULL AND auction_record.time_left IS NOT NULL THEN
      UPDATE public.auctions 
      SET ends_at = brazil_now + (auction_record.time_left || ' seconds')::interval,
          updated_at = brazil_now
      WHERE id = auction_record.id;
      
      RAISE LOG 'Set ends_at for auction %: % seconds from now', auction_record.id, auction_record.time_left;
    
    -- Only update time_left if auction hasn't been updated very recently (last 5 seconds)
    -- This prevents overwriting the timer when a bid was just placed
    ELSIF auction_record.ends_at IS NOT NULL 
      AND (brazil_now - auction_record.updated_at) > INTERVAL '5 seconds' THEN
      
      time_remaining := GREATEST(0, EXTRACT(EPOCH FROM (auction_record.ends_at - brazil_now))::integer);
      
      -- Only update if the calculated time is different from current time_left
      IF time_remaining != auction_record.time_left THEN
        UPDATE public.auctions 
        SET time_left = time_remaining,
            updated_at = brazil_now
        WHERE id = auction_record.id;
        
        RAISE LOG 'Updated time_left for auction % from % to %', auction_record.id, auction_record.time_left, time_remaining;
      END IF;
      
      -- If time is up, mark as finished
      IF time_remaining = 0 THEN
        UPDATE public.auctions 
        SET status = 'finished',
            updated_at = brazil_now
        WHERE id = auction_record.id;
        
        RAISE LOG 'Auction % finished - time expired', auction_record.id;
      END IF;
    
    -- For recently updated auctions (within 5 seconds), just check protection activation
    ELSIF auction_record.ends_at IS NOT NULL THEN
      time_remaining := GREATEST(0, EXTRACT(EPOCH FROM (auction_record.ends_at - brazil_now))::integer);
      
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
  
  RAISE LOG 'Timer sync completed at %', brazil_now;
END;
$$;