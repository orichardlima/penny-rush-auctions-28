-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Atomic SQL function to execute overdue bot bids
-- Fast (<50ms), uses FOR UPDATE SKIP LOCKED to prevent conflicts
CREATE OR REPLACE FUNCTION public.execute_overdue_bot_bids()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_bot_id uuid;
  v_new_price numeric;
  v_executed int := 0;
  v_stale int := 0;
BEGIN
  FOR v_auction IN
    SELECT id, current_price, bid_increment, scheduled_bot_bid_at, scheduled_bot_band, last_bid_at
    FROM auctions
    WHERE status = 'active'
      AND scheduled_bot_bid_at IS NOT NULL
      AND scheduled_bot_bid_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Validate cycle: schedule must be from current bid cycle
    IF v_auction.scheduled_bot_bid_at < v_auction.last_bid_at THEN
      UPDATE auctions 
      SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL 
      WHERE id = v_auction.id;
      v_stale := v_stale + 1;
      CONTINUE;
    END IF;
    
    -- Anti-spam: skip if bot bid placed in last 3 seconds
    IF EXISTS (
      SELECT 1 FROM bids 
      WHERE auction_id = v_auction.id 
        AND cost_paid = 0 
        AND created_at >= now() - interval '3 seconds'
      LIMIT 1
    ) THEN
      CONTINUE;
    END IF;
    
    -- Get random bot
    SELECT user_id INTO v_bot_id 
    FROM profiles 
    WHERE is_bot = true 
    ORDER BY random() 
    LIMIT 1;
    
    IF v_bot_id IS NULL THEN CONTINUE; END IF;
    
    v_new_price := v_auction.current_price + v_auction.bid_increment;
    
    -- Insert bid (update_auction_on_bid trigger handles price/timer/last_bid_at update)
    INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
    VALUES (v_auction.id, v_bot_id, v_new_price, 0);
    
    -- Clear schedule and record the band used
    UPDATE auctions 
    SET last_bot_band = v_auction.scheduled_bot_band,
        scheduled_bot_bid_at = NULL,
        scheduled_bot_band = NULL
    WHERE id = v_auction.id;
    
    v_executed := v_executed + 1;
  END LOOP;
  
  RETURN jsonb_build_object('executed', v_executed, 'stale', v_stale);
END;
$$;

-- Trigger function: fires pg_net call to edge function when bot bid is scheduled
-- Provides additional async execution opportunity
CREATE OR REPLACE FUNCTION public.notify_bot_bid_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.scheduled_bot_bid_at IS NOT NULL 
     AND OLD.scheduled_bot_bid_at IS DISTINCT FROM NEW.scheduled_bot_bid_at THEN
    PERFORM net.http_post(
      url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb,
      body := jsonb_build_object('trigger', 'pg_net_bot_scheduled', 'auction_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bot_bid_scheduled ON auctions;
CREATE TRIGGER trg_notify_bot_bid_scheduled
  AFTER UPDATE OF scheduled_bot_bid_at ON auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_bot_bid_scheduled();

-- pg_cron: execute overdue bot bids every minute (direct SQL call, fast)
SELECT cron.schedule(
  'execute-overdue-bot-bids',
  '* * * * *',
  $$SELECT public.execute_overdue_bot_bids()$$
);