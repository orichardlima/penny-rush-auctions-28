-- Criar trigger para finalizar leilões automaticamente quando timer chega a 0
-- Esta função será executada sempre que o time_left for atualizado

CREATE OR REPLACE FUNCTION public.trigger_finish_auction_on_timer_end()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    last_bidder_record RECORD;
    winner_name TEXT;
BEGIN
    -- Log para debug
    RAISE LOG 'Timer trigger fired for auction % - Status: %, Time: %', 
        NEW.id, NEW.status, NEW.time_left;
    
    -- Só executa se o leilão está ativo e time_left chegou a 0 ou menor
    IF NEW.status = 'active' AND NEW.time_left <= 0 THEN
        
        RAISE LOG 'Finalizing auction % due to timer expiration', NEW.id;
        
        -- Buscar o último lance (ganhador)
        SELECT b.*, p.full_name, p.user_id
        INTO last_bidder_record
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = NEW.id
        ORDER BY b.created_at DESC
        LIMIT 1;

        -- Definir nome do ganhador
        IF last_bidder_record.full_name IS NOT NULL AND length(trim(last_bidder_record.full_name)) > 0 THEN
            winner_name := last_bidder_record.full_name;
        ELSIF last_bidder_record.user_id IS NOT NULL THEN
            winner_name := 'Usuário ' || SUBSTRING(last_bidder_record.user_id::text FROM 1 FOR 8);
        ELSE
            winner_name := NULL;
        END IF;

        -- Atualizar o leilão com status finalizado
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

-- Criar o trigger que executa ANTES de qualquer UPDATE na tabela auctions
DROP TRIGGER IF EXISTS trigger_finish_auction_on_timer_end ON public.auctions;

CREATE TRIGGER trigger_finish_auction_on_timer_end
    BEFORE UPDATE ON public.auctions
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_finish_auction_on_timer_end();

-- Configurar uma verificação periódica via pg_cron para capturar casos extremos
-- Esta função vai rodar a cada 30 segundos para garantir que não há leilões órfãos
SELECT cron.schedule(
    'cleanup-orphaned-auctions',
    '*/30 * * * * *', -- A cada 30 segundos
    $$
    UPDATE public.auctions 
    SET 
        status = 'finished',
        time_left = 0,
        finished_at = NOW(),
        updated_at = NOW()
    WHERE status = 'active' 
      AND (time_left <= 0 OR ends_at < NOW())
      AND updated_at < NOW() - INTERVAL '1 minute';
    $$
);