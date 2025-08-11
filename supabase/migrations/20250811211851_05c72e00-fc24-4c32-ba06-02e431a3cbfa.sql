-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing timer update jobs to avoid duplicates
SELECT cron.unschedule('update-auction-timers');

-- Create cron job to update auction timers every second
SELECT cron.schedule(
  'update-auction-timers',
  '* * * * *', -- Every minute (most frequent interval available in pg_cron)
  $$
  SELECT public.update_auction_timers();
  $$
);

-- Create trigger to finalize auctions when time_left becomes 0
DROP TRIGGER IF EXISTS trigger_finalize_auction_on_timer_zero ON public.auctions;

CREATE TRIGGER trigger_finalize_auction_on_timer_zero
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.finalize_auction_on_timer_zero();

-- Update the timer function to run more frequently within each minute
CREATE OR REPLACE FUNCTION public.update_auction_timers()
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
  utc_now := now();
  
  -- Update all active auctions
  FOR auction_record IN 
    SELECT id, time_left, ends_at, updated_at, status
    FROM public.auctions 
    WHERE status = 'active' AND ends_at IS NOT NULL
  LOOP
    -- Calculate time remaining
    time_remaining := GREATEST(0, EXTRACT(EPOCH FROM (auction_record.ends_at - utc_now))::integer);
    
    -- Update time_left if different from current value
    IF time_remaining != COALESCE(auction_record.time_left, 0) THEN
      UPDATE public.auctions 
      SET time_left = time_remaining,
          updated_at = utc_now
      WHERE id = auction_record.id;
      
      RAISE LOG 'Timer updated for auction %: % seconds remaining', auction_record.id, time_remaining;
    END IF;
  END LOOP;
  
  RAISE LOG 'Timer sync completed at % (UTC)', utc_now;
END;
$function$;