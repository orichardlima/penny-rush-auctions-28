-- Remove all bot-related functionality from the system

-- Step 1: Drop bot-related tables
DROP TABLE IF EXISTS public.bot_logs CASCADE;
DROP TABLE IF EXISTS public.fake_users CASCADE;

-- Step 2: Drop bot-related functions
DROP FUNCTION IF EXISTS public.get_random_fake_user() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_bot_user() CASCADE;

-- Step 3: Remove bot-related columns from bids table
ALTER TABLE public.bids DROP COLUMN IF EXISTS is_bot;

-- Step 4: Remove auto-bid and protection columns from auctions table
ALTER TABLE public.auctions DROP COLUMN IF EXISTS auto_bid_enabled;
ALTER TABLE public.auctions DROP COLUMN IF EXISTS auto_bid_min_interval;
ALTER TABLE public.auctions DROP COLUMN IF EXISTS auto_bid_max_interval;
ALTER TABLE public.auctions DROP COLUMN IF EXISTS last_auto_bid_at;
ALTER TABLE public.auctions DROP COLUMN IF EXISTS min_revenue_target;
ALTER TABLE public.auctions DROP COLUMN IF EXISTS protected_mode;
ALTER TABLE public.auctions DROP COLUMN IF EXISTS protected_target;

-- Step 5: Simplify update_auction_stats trigger (remove protection logic)
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
  
  RETURN NEW;
END;
$function$;

-- Step 6: Simplify update_auction_timers (remove protection logic)
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
    
    -- Only update time_left if auction hasn't been updated in the last 10 seconds
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
    
    -- For recently updated auctions (within 10 seconds), just log and skip
    ELSIF auction_record.ends_at IS NOT NULL THEN
      RAISE LOG 'Skipping timer update for recently updated auction % (updated % seconds ago)', 
        auction_record.id, EXTRACT(EPOCH FROM (utc_now - auction_record.updated_at));
    END IF;
  END LOOP;
  
  RAISE LOG 'Timer sync completed at % (UTC)', utc_now;
END;
$$;