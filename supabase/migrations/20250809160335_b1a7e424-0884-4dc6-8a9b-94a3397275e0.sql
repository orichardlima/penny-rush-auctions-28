-- Limpar completamente e recriar sistema de finalização de leilões

-- 1) Remover TODOS os triggers relacionados
DROP TRIGGER IF EXISTS trigger_finish_auction_on_timer_end ON public.auctions;
DROP TRIGGER IF EXISTS tr_auto_finalize_on_timer_end ON public.auctions;
DROP TRIGGER IF EXISTS finish_auction_when_timer_ends_trigger ON public.auctions;

-- 2) Remover TODAS as funções relacionadas
DROP FUNCTION IF EXISTS public.trigger_finish_auction_on_timer_end();
DROP FUNCTION IF EXISTS public.auto_finalize_auction_on_timer_end();
DROP FUNCTION IF EXISTS public.finish_auction_when_timer_ends();
DROP FUNCTION IF EXISTS public.cleanup_orphaned_auctions();

-- 3) Remover foreign key constraint se existir
ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS auctions_winner_id_fkey;

-- 4) Criar nova função de finalização automática
CREATE OR REPLACE FUNCTION public.finalize_auction_on_timer_zero()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    winner_user_id uuid;
    winner_full_name TEXT;
    final_winner_name TEXT;
BEGIN
    -- Log para debug
    RAISE LOG 'Finalize trigger: auction % - Status: %, Time: %', 
        NEW.id, NEW.status, NEW.time_left;
    
    -- Só executa se o leilão está ativo e time_left chegou a 0 ou menor
    IF NEW.status = 'active' AND NEW.time_left <= 0 THEN
        
        RAISE LOG 'Finalizing auction % due to timer expiration', NEW.id;
        
        -- Buscar o último lance (ganhador)
        SELECT b.user_id, p.full_name
        INTO winner_user_id, winner_full_name
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = NEW.id
        ORDER BY b.created_at DESC
        LIMIT 1;

        -- Definir nome do ganhador
        IF winner_full_name IS NOT NULL AND length(trim(winner_full_name)) > 0 THEN
            final_winner_name := winner_full_name;
        ELSIF winner_user_id IS NOT NULL THEN
            final_winner_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
        ELSE
            final_winner_name := NULL;
        END IF;

        -- Atualizar campos do leilão
        NEW.status := 'finished';
        NEW.time_left := 0;
        NEW.winner_id := winner_user_id;
        NEW.winner_name := final_winner_name;
        NEW.finished_at := NOW();
        NEW.updated_at := NOW();

        RAISE LOG 'Auction % finalized automatically - Winner: % (ID: %)', 
            NEW.id, final_winner_name, winner_user_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- 5) Criar trigger BEFORE UPDATE
CREATE TRIGGER tr_finalize_auction_on_timer_zero
    BEFORE UPDATE ON public.auctions
    FOR EACH ROW
    EXECUTE FUNCTION public.finalize_auction_on_timer_zero();

-- 6) Criar função de limpeza para cron job
CREATE OR REPLACE FUNCTION public.cleanup_expired_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    auction_to_finish RECORD;
    winner_user_id uuid;
    winner_full_name TEXT;
    final_winner_name TEXT;
    updated_count integer := 0;
BEGIN
    -- Buscar leilões ativos que deveriam estar finalizados
    FOR auction_to_finish IN 
        SELECT id, title, time_left, ends_at, status
        FROM public.auctions 
        WHERE status = 'active' 
          AND (time_left <= 0 OR (ends_at IS NOT NULL AND ends_at <= NOW()))
    LOOP
        -- Buscar o último lance (ganhador)
        SELECT b.user_id, p.full_name
        INTO winner_user_id, winner_full_name
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = auction_to_finish.id
        ORDER BY b.created_at DESC
        LIMIT 1;

        -- Definir nome do ganhador
        IF winner_full_name IS NOT NULL AND length(trim(winner_full_name)) > 0 THEN
            final_winner_name := winner_full_name;
        ELSIF winner_user_id IS NOT NULL THEN
            final_winner_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
        ELSE
            final_winner_name := NULL;
        END IF;

        -- Finalizar o leilão
        UPDATE public.auctions 
        SET 
            status = 'finished',
            time_left = 0,
            winner_id = winner_user_id,
            winner_name = final_winner_name,
            finished_at = NOW(),
            updated_at = NOW()
        WHERE id = auction_to_finish.id;

        updated_count := updated_count + 1;
        
        RAISE LOG 'Cleanup: Auction % (%) finalized - Winner: % (ID: %)', 
            auction_to_finish.id, auction_to_finish.title, final_winner_name, winner_user_id;
    END LOOP;
    
    IF updated_count > 0 THEN
        RAISE LOG 'Cleanup completed: % expired auctions finalized', updated_count;
    END IF;
END;
$function$;

-- 7) Configurar cron job
SELECT cron.unschedule('cleanup-orphaned-auctions');
SELECT cron.unschedule('cleanup-expired-auctions');

SELECT cron.schedule(
    'cleanup-expired-auctions',
    '*/10 * * * * *', -- A cada 10 segundos
    $$
    SELECT public.cleanup_expired_auctions();
    $$
);

-- 8) Executar limpeza imediata
SELECT public.cleanup_expired_auctions();