-- Corrigir a última função que provavelmente ainda está sem search_path

CREATE OR REPLACE FUNCTION public.trigger_auction_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  webhook_exists boolean := false;
BEGIN
  -- Only trigger if status changed from something else to 'active'
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
    
    -- Verificar se já existe um log de webhook para esta ativação específica
    SELECT EXISTS(
      SELECT 1 FROM public.bot_webhook_logs 
      WHERE auction_id = NEW.id 
      AND created_at > NEW.updated_at - INTERVAL '1 minute'
    ) INTO webhook_exists;
    
    -- Só disparar webhook se não foi disparado recentemente
    IF NOT webhook_exists THEN
      -- Call the edge function asynchronously to avoid blocking the update
      PERFORM net.http_post(
        url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/auction-webhook',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
        ),
        body := jsonb_build_object('auction_id', NEW.id::text)
      );
      
      RAISE LOG 'Webhook triggered for auction activation: % (first time)', NEW.id;
    ELSE
      RAISE LOG 'Webhook skipped for auction %: already triggered recently', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;