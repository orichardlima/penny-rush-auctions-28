-- Fix auction activation logic and timer management

-- 1. Create trigger to set ends_at when auction becomes active
CREATE OR REPLACE FUNCTION public.set_auction_end_time()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set ends_at when status changes TO 'active' and ends_at is null
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' AND NEW.ends_at IS NULL THEN
    NEW.ends_at := NOW() + INTERVAL '15 seconds';
    NEW.time_left := 15;
    NEW.updated_at := NOW();
    
    RAISE LOG 'Auction % activated: ends_at set to %, time_left set to 15', 
      NEW.id, NEW.ends_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auction activation
DROP TRIGGER IF EXISTS set_auction_end_time_trigger ON public.auctions;
CREATE TRIGGER set_auction_end_time_trigger
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_auction_end_time();

-- 2. Improve cleanup_expired_auctions function with safety buffer
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
  activation_buffer_seconds integer := 5; -- Don't process auctions activated in last 5 seconds
BEGIN
  utc_now := NOW();
  
  RAISE LOG 'Starting cleanup of expired auctions at %', utc_now;
  
  -- Process active auctions, but skip recently activated ones
  FOR auction_record IN 
    SELECT id, time_left, ends_at, status, title, updated_at
    FROM public.auctions 
    WHERE status = 'active'
      AND ends_at IS NOT NULL
      -- Skip auctions that were just activated (safety buffer)
      AND (updated_at < utc_now - (activation_buffer_seconds || ' seconds')::interval OR time_left < 10)
  LOOP
    
    -- Calculate actual time remaining
    time_remaining := GREATEST(0, EXTRACT(EPOCH FROM (auction_record.ends_at - utc_now))::integer);
    
    -- Only update if there's a significant difference (more than 2 seconds)
    IF ABS(time_remaining - COALESCE(auction_record.time_left, 0)) > 2 THEN
      UPDATE public.auctions 
      SET time_left = time_remaining,
          updated_at = utc_now
      WHERE id = auction_record.id;
      
      RAISE LOG 'Updated timer for auction %: % -> % seconds (ends_at: %)', 
        auction_record.id, auction_record.time_left, time_remaining, auction_record.ends_at;
    END IF;
    
  END LOOP;
  
  RAISE LOG 'Cleanup completed at %', utc_now;
END;
$function$;

-- 3. Improve finalize_auction_on_timer_zero with additional safety checks
CREATE OR REPLACE FUNCTION public.finalize_auction_on_timer_zero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    last_bidder_record RECORD;
    winner_name TEXT;
    utc_now timestamptz;
    seconds_since_activation integer;
BEGIN
    utc_now := NOW();
    
    -- Only process if auction is active and time_left reaches 0 or less
    IF NEW.status = 'active' AND NEW.time_left <= 0 AND NEW.ends_at IS NOT NULL THEN
        
        -- Safety check: Don't finalize auctions that were just activated (less than 10 seconds ago)
        seconds_since_activation := EXTRACT(EPOCH FROM (utc_now - NEW.updated_at))::integer;
        
        IF seconds_since_activation < 10 THEN
            RAISE LOG 'Skipping finalization of auction % - too recently activated (% seconds ago)', 
              NEW.id, seconds_since_activation;
            RETURN NEW;
        END IF;
        
        -- Additional check: verify ends_at has actually passed
        IF NEW.ends_at > utc_now THEN
            RAISE LOG 'Skipping finalization of auction % - ends_at % is still in the future', 
              NEW.id, NEW.ends_at;
            RETURN NEW;
        END IF;
        
        RAISE LOG 'Finalizing auction % due to timer expiration (time_left: %, seconds_since_activation: %)', 
          NEW.id, NEW.time_left, seconds_since_activation;
        
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
        NEW.finished_at := utc_now;
        NEW.updated_at := utc_now;

        RAISE LOG 'Auction % finalized - Winner: % (ID: %), final_price: %', 
            NEW.id, winner_name, last_bidder_record.user_id, NEW.current_price;
    END IF;

    RETURN NEW;
END;
$function$;

-- 4. Update the update_auction_stats function to ensure consistent timer setting
CREATE OR REPLACE FUNCTION public.update_auction_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  utc_now timestamptz;
  new_ends_at timestamptz;
  is_bot_user boolean := false;
BEGIN
  -- Use UTC consistently
  utc_now := now();
  
  -- Calculate new end time with 16-second buffer to ensure 15 seconds minimum
  new_ends_at := utc_now + INTERVAL '16 seconds';
  
  -- Verificar se o usuário é um bot
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  -- Update auction stats
  IF is_bot_user THEN
    -- Bot lance: incrementa current_price e total_bids, mas NÃO incrementa company_revenue
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      ends_at = new_ends_at,
      time_left = 15,
      updated_at = utc_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG 'Bot bid placed on auction %: timer reset to 15 seconds, ends_at set to %, NO revenue added', 
      NEW.auction_id, new_ends_at;
  ELSE
    -- Usuário real: incrementa current_price, total_bids E company_revenue
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + (bid_cost / 100.0), -- bid_cost está em centavos, converter para reais
      ends_at = new_ends_at,
      time_left = 15,
      updated_at = utc_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG 'User bid placed on auction %: timer reset to 15 seconds, ends_at set to %, revenue increased by R$%.2f', 
      NEW.auction_id, new_ends_at, (NEW.cost_paid / 100.0);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 5. Update existing auctions that have null ends_at but are active
UPDATE public.auctions 
SET 
  ends_at = NOW() + INTERVAL '15 seconds',
  time_left = 15,
  updated_at = NOW()
WHERE status = 'active' 
  AND ends_at IS NULL;

RAISE LOG 'Updated % active auctions with null ends_at', 
  (SELECT COUNT(*) FROM public.auctions WHERE status = 'active' AND ends_at IS NULL);