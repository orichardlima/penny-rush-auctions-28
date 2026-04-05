CREATE OR REPLACE FUNCTION public.notify_bot_bid_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anon_key text;
  v_url text := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection';
BEGIN
  IF NEW.scheduled_bot_bid_at IS NOT NULL 
     AND OLD.scheduled_bot_bid_at IS DISTINCT FROM NEW.scheduled_bot_bid_at THEN
    
    v_anon_key := current_setting('supabase.anon_key', true);
    
    IF v_anon_key IS NULL OR v_anon_key = '' THEN
      RAISE NOTICE 'notify_bot_bid_scheduled: current_setting não disponível, usando fallback';
      v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k';
    END IF;
    
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object('trigger', 'pg_net_bot_scheduled', 'auction_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;