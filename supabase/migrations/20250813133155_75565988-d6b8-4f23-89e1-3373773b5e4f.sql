-- Corrigir a função de finalização de leilões expirados
CREATE OR REPLACE FUNCTION public.finalize_expired_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record record;
  utc_now timestamptz;
  last_bid_time timestamptz;
  seconds_since_last_activity integer;
BEGIN
  utc_now := NOW();
  
  RAISE LOG 'Starting cleanup of expired auctions at %', utc_now;
  
  -- Processar leilões ativos que podem estar expirados
  FOR auction_record IN 
    SELECT id, title, updated_at, ends_at, time_left, status
    FROM public.auctions 
    WHERE status = 'active'
  LOOP
    
    -- Buscar timestamp do último lance para este leilão
    SELECT MAX(created_at) INTO last_bid_time
    FROM public.bids 
    WHERE auction_id = auction_record.id;
    
    -- Se não há lances, usar o updated_at do leilão (quando virou active)
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
    END IF;
    
    -- Calcular quantos segundos se passaram desde a última atividade
    seconds_since_last_activity := EXTRACT(EPOCH FROM (utc_now - last_bid_time))::integer;
    
    -- Se passou mais de 15 segundos desde a última atividade, encerrar o leilão
    IF seconds_since_last_activity >= 15 THEN
      
      DECLARE
        last_bidder_record RECORD;
        winner_name TEXT;
      BEGIN
        -- Encontrar o último lance (ganhador)
        SELECT b.user_id, p.full_name
        INTO last_bidder_record
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = auction_record.id
        ORDER BY b.created_at DESC
        LIMIT 1;

        -- Definir nome do ganhador
        IF last_bidder_record.full_name IS NOT NULL AND length(trim(last_bidder_record.full_name)) > 0 THEN
            winner_name := last_bidder_record.full_name;
        ELSIF last_bidder_record.user_id IS NOT NULL THEN
            winner_name := 'Usuário ' || SUBSTRING(last_bidder_record.user_id::text FROM 1 FOR 8);
        ELSE
            winner_name := 'Nenhum ganhador';
        END IF;

        -- Encerrar o leilão
        UPDATE public.auctions
        SET 
          status = 'finished',
          time_left = 0,
          winner_id = last_bidder_record.user_id,
          winner_name = winner_name,
          finished_at = utc_now,
          updated_at = utc_now
        WHERE id = auction_record.id;
        
        RAISE LOG 'AUCTION FINALIZED: % (ID: %) - % seconds since last activity. Winner: % (ID: %)', 
          auction_record.title, auction_record.id, seconds_since_last_activity, 
          winner_name, last_bidder_record.user_id;
      END;
      
    ELSE
      RAISE LOG 'Auction % still active - only % seconds since last activity (needs 15)', 
        auction_record.id, seconds_since_last_activity;
    END IF;
    
  END LOOP;
  
  RAISE LOG 'Cleanup completed at %', utc_now;
END;
$function$;

-- Corrigir a função de webhook para evitar múltiplas chamadas
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

-- Garantir que o trigger de webhook está ativo
DROP TRIGGER IF EXISTS trigger_auction_webhook_trigger ON public.auctions;
CREATE TRIGGER trigger_auction_webhook_trigger
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auction_webhook();