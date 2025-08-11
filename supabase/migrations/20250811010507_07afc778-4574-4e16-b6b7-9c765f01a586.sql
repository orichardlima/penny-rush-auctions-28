-- Step 1: Drop all triggers and functions with CASCADE to handle dependencies
DROP TRIGGER IF EXISTS trigger_finish_auction_on_timer_end ON public.auctions CASCADE;
DROP TRIGGER IF EXISTS tr_auctions_after_update_finish ON public.auctions CASCADE;
DROP TRIGGER IF EXISTS finish_auction_when_timer_ends ON public.auctions CASCADE;
DROP TRIGGER IF EXISTS check_bot_intervention_trigger ON public.auctions CASCADE;
DROP TRIGGER IF EXISTS bot_intervention_trigger ON public.auctions CASCADE;
DROP TRIGGER IF EXISTS tr_auctions_after_update_bot_intervention ON public.auctions CASCADE;

DROP FUNCTION IF EXISTS public.trigger_finish_auction_on_timer_end() CASCADE;
DROP FUNCTION IF EXISTS public.finish_auction_when_timer_ends() CASCADE;
DROP FUNCTION IF EXISTS public.check_bot_intervention() CASCADE;

-- Step 2: Remove the problematic foreign key constraint
ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS auctions_winner_id_fkey;

-- Step 3: Create optimized auction finalization function
CREATE OR REPLACE FUNCTION public.finalize_auction_on_timer_zero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    last_bidder_record RECORD;
    winner_name TEXT;
BEGIN
    -- Only process if auction is active and time_left reaches 0 or less
    IF NEW.status = 'active' AND NEW.time_left <= 0 THEN
        
        RAISE LOG 'Finalizing auction % due to timer expiration (time_left: %)', NEW.id, NEW.time_left;
        
        -- Find the last bidder (winner)
        SELECT b.user_id, p.full_name
        INTO last_bidder_record
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = NEW.id
        ORDER BY b.created_at DESC
        LIMIT 1;

        -- Set winner name
        IF last_bidder_record.full_name IS NOT NULL AND length(trim(last_bidder_record.full_name)) > 0 THEN
            winner_name := last_bidder_record.full_name;
        ELSIF last_bidder_record.user_id IS NOT NULL THEN
            winner_name := 'Usuário ' || SUBSTRING(last_bidder_record.user_id::text FROM 1 FOR 8);
        ELSE
            winner_name := 'Nenhum ganhador';
        END IF;

        -- Update auction to finished status (modify NEW to avoid recursive triggers)
        NEW.status := 'finished';
        NEW.time_left := 0;
        NEW.winner_id := last_bidder_record.user_id;
        NEW.winner_name := winner_name;
        NEW.finished_at := NOW();
        NEW.updated_at := NOW();

        RAISE LOG 'Auction % finalized - Winner: % (ID: %)', 
            NEW.id, winner_name, last_bidder_record.user_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- Step 4: Create trigger for automatic finalization
CREATE TRIGGER tr_finalize_auction_on_timer_zero
    BEFORE UPDATE ON public.auctions
    FOR EACH ROW
    EXECUTE FUNCTION public.finalize_auction_on_timer_zero();

-- Step 5: Create cleanup function for expired auctions
CREATE OR REPLACE FUNCTION public.cleanup_expired_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record record;
  utc_now timestamptz;
  time_remaining integer;
BEGIN
  utc_now := NOW();
  
  RAISE LOG 'Starting cleanup of expired auctions at %', utc_now;
  
  -- Process all active auctions
  FOR auction_record IN 
    SELECT id, time_left, ends_at, status, title
    FROM public.auctions 
    WHERE status = 'active'
  LOOP
    
    -- Calculate actual time remaining
    IF auction_record.ends_at IS NOT NULL THEN
      time_remaining := GREATEST(0, EXTRACT(EPOCH FROM (auction_record.ends_at - utc_now))::integer);
      
      -- Update time_left if significantly different
      IF ABS(time_remaining - COALESCE(auction_record.time_left, 0)) > 1 THEN
        UPDATE public.auctions 
        SET time_left = time_remaining,
            updated_at = utc_now
        WHERE id = auction_record.id;
        
        RAISE LOG 'Updated timer for auction %: % -> % seconds', 
          auction_record.id, auction_record.time_left, time_remaining;
      END IF;
      
    ELSIF auction_record.time_left IS NOT NULL AND auction_record.time_left > 0 THEN
      -- Set ends_at if missing but time_left exists
      UPDATE public.auctions 
      SET ends_at = utc_now + (auction_record.time_left || ' seconds')::interval,
          updated_at = utc_now
      WHERE id = auction_record.id;
      
      RAISE LOG 'Set ends_at for auction %: % seconds from now', 
        auction_record.id, auction_record.time_left;
    END IF;
    
  END LOOP;
  
  RAISE LOG 'Cleanup completed at %', utc_now;
END;
$function$;

-- Step 6: Schedule cron job to run every 10 seconds
SELECT cron.schedule(
  'cleanup-expired-auctions-10s',
  '*/10 * * * * *', -- Every 10 seconds
  $$
  SELECT public.cleanup_expired_auctions();
  $$
);

-- Step 7: Execute immediate cleanup
SELECT public.cleanup_expired_auctions();