-- Corrigir funções com search_path faltando para resolver avisos de segurança

CREATE OR REPLACE FUNCTION public.set_auction_end_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' AND NEW.ends_at IS NULL THEN
    NEW.ends_at := timezone('America/Sao_Paulo', now()) + INTERVAL '15 seconds';
    NEW.time_left := 15;
    NEW.updated_at := timezone('America/Sao_Paulo', now());
    
    RAISE LOG 'Auction % activated: ends_at set to % (BR), time_left set to 15', 
      NEW.id, NEW.ends_at;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auction_webhook_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  webhook_already_sent boolean := false;
BEGIN
  -- Apenas dispara se mudou de 'waiting' para 'active'
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
    
    -- Verificar se já foi enviado webhook recentemente (último minuto)
    SELECT EXISTS(
      SELECT 1 FROM public.bot_webhook_logs 
      WHERE auction_id = NEW.id 
      AND created_at > timezone('America/Sao_Paulo', now()) - INTERVAL '1 minute'
      AND status = 'success'
    ) INTO webhook_already_sent;
    
    -- Só enviar se não foi enviado recentemente
    IF NOT webhook_already_sent THEN
      
      -- Chamar Edge Function de forma assíncrona
      PERFORM net.http_post(
        url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/auction-webhook',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
        ),
        body := jsonb_build_object('auction_id', NEW.id::text)
      );
      
      RAISE LOG '🚀 WEBHOOK ÚNICO disparado para leilão %', NEW.id;
    ELSE
      RAISE LOG '⚠️ WEBHOOK já foi enviado para leilão % - BLOQUEADO', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;