-- Verificar e corrigir foreign key constraint do winner_id

-- 1) Primeiro vamos verificar se existe a foreign key constraint
DO $$
DECLARE
    constraint_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'auctions' 
        AND constraint_name LIKE '%winner_id%'
        AND constraint_type = 'FOREIGN KEY'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE LOG 'Foreign key constraint exists on winner_id, removing it';
        -- Remover a foreign key constraint
        ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS auctions_winner_id_fkey;
        RAISE LOG 'Foreign key constraint removed from winner_id';
    ELSE
        RAISE LOG 'No foreign key constraint found on winner_id';
    END IF;
END $$;

-- 2) Criar função melhorada para finalizar leilões quando timer zerar
CREATE OR REPLACE FUNCTION public.auto_finalize_auction_on_timer_end()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    last_bidder_record RECORD;
    calculated_winner_name TEXT;
BEGIN
    -- Log para debug
    RAISE LOG 'Auto-finalize trigger fired for auction % - Status: %, Time: %', 
        NEW.id, NEW.status, NEW.time_left;
    
    -- Só executa se o leilão está ativo e time_left chegou a 0 ou menor
    IF NEW.status = 'active' AND NEW.time_left <= 0 THEN
        
        RAISE LOG 'Auto-finalizing auction % due to timer expiration', NEW.id;
        
        -- Buscar o último lance (ganhador)
        SELECT b.user_id, p.full_name
        INTO last_bidder_record
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = NEW.id
        ORDER BY b.created_at DESC
        LIMIT 1;

        -- Definir nome do ganhador
        IF last_bidder_record.full_name IS NOT NULL AND length(trim(last_bidder_record.full_name)) > 0 THEN
            calculated_winner_name := last_bidder_record.full_name;
        ELSIF last_bidder_record.user_id IS NOT NULL THEN
            calculated_winner_name := 'Usuário ' || SUBSTRING(last_bidder_record.user_id::text FROM 1 FOR 8);
        ELSE
            calculated_winner_name := NULL;
        END IF;

        -- Atualizar o leilão com status finalizado
        NEW.status := 'finished';
        NEW.time_left := 0;
        NEW.winner_id := last_bidder_record.user_id;
        NEW.winner_name := calculated_winner_name;
        NEW.finished_at := NOW();
        NEW.updated_at := NOW();

        RAISE LOG 'Auction % auto-finalized - Winner: % (ID: %)', 
            NEW.id, calculated_winner_name, last_bidder_record.user_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- 3) Criar trigger BEFORE UPDATE para interceptar atualizações de timer
DROP TRIGGER IF EXISTS tr_auto_finalize_on_timer_end ON public.auctions;
CREATE TRIGGER tr_auto_finalize_on_timer_end
    BEFORE UPDATE ON public.auctions
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_finalize_auction_on_timer_end();

-- 4) Criar função para finalizar leilões órfãos via cron
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    auction_record RECORD;
    last_bidder_user_id uuid;
    last_bidder_name TEXT;
    calculated_winner_name TEXT;
    updated_count integer := 0;
BEGIN
    -- Buscar leilões ativos que deveriam estar finalizados
    FOR auction_record IN 
        SELECT id, title, time_left, ends_at, status
        FROM public.auctions 
        WHERE status = 'active' 
          AND (time_left <= 0 OR (ends_at IS NOT NULL AND ends_at <= NOW()))
    LOOP
        -- Buscar o último lance (ganhador) apenas user_id e nome
        SELECT b.user_id, p.full_name
        INTO last_bidder_user_id, last_bidder_name
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = auction_record.id
        ORDER BY b.created_at DESC
        LIMIT 1;

        -- Definir nome do ganhador
        IF last_bidder_name IS NOT NULL AND length(trim(last_bidder_name)) > 0 THEN
            calculated_winner_name := last_bidder_name;
        ELSIF last_bidder_user_id IS NOT NULL THEN
            calculated_winner_name := 'Usuário ' || SUBSTRING(last_bidder_user_id::text FROM 1 FOR 8);
        ELSE
            calculated_winner_name := NULL;
        END IF;

        -- Finalizar o leilão órfão
        UPDATE public.auctions 
        SET 
            status = 'finished',
            time_left = 0,
            winner_id = last_bidder_user_id,
            winner_name = calculated_winner_name,
            finished_at = NOW(),
            updated_at = NOW()
        WHERE id = auction_record.id;

        updated_count := updated_count + 1;
        
        RAISE LOG 'Cleanup: Auction % (%) finalized - Winner: % (ID: %)', 
            auction_record.id, auction_record.title, calculated_winner_name, last_bidder_user_id;
    END LOOP;
    
    IF updated_count > 0 THEN
        RAISE LOG 'Cleanup completed: % orphaned auctions finalized', updated_count;
    END IF;
END;
$function$;

-- 5) Recriar o cron job com intervalo mais frequente para capturar casos extremos
SELECT cron.unschedule('cleanup-orphaned-auctions');

SELECT cron.schedule(
    'cleanup-orphaned-auctions',
    '*/15 * * * * *', -- A cada 15 segundos
    $$
    SELECT public.cleanup_orphaned_auctions();
    $$
);

-- 6) Executar limpeza imediata de leilões órfãos existentes
SELECT public.cleanup_orphaned_auctions();