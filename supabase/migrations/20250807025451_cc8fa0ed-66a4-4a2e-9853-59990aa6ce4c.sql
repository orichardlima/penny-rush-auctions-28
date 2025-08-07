-- Fix the security issue by setting search_path for the function
CREATE OR REPLACE FUNCTION public.trigger_auction_webhook()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only trigger if status changed from something else to 'active'
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
    -- Call the edge function asynchronously to avoid blocking the update
    PERFORM net.http_post(
      url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/auction-webhook',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
      ),
      body := jsonb_build_object('auction_id', NEW.id::text)
    );
    
    RAISE LOG 'Webhook triggered for auction activation: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;