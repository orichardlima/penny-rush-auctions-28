-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar função para encerrar leilões expirados
CREATE OR REPLACE FUNCTION finalize_expired_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    auction_record RECORD;
    expired_count INTEGER := 0;
BEGIN
    -- Log início da execução
    RAISE NOTICE 'Iniciando verificação de leilões expirados...';
    
    -- Buscar leilões ativos expirados (15+ segundos sem atualização)
    FOR auction_record IN 
        SELECT id, title, updated_at, current_price, total_bids
        FROM auctions 
        WHERE status = 'active' 
        AND updated_at < (NOW() - INTERVAL '15 seconds')
    LOOP
        -- Log do leilão sendo processado
        RAISE NOTICE 'Encerrando leilão %: % (inativo há % segundos)', 
            auction_record.id, 
            auction_record.title,
            EXTRACT(EPOCH FROM (NOW() - auction_record.updated_at));
        
        -- Buscar ganhador (último lance)
        DECLARE
            winner_user_id UUID;
            winner_name TEXT;
        BEGIN
            SELECT b.user_id, p.full_name
            INTO winner_user_id, winner_name
            FROM bids b
            LEFT JOIN profiles p ON p.user_id = b.user_id
            WHERE b.auction_id = auction_record.id
            ORDER BY b.created_at DESC
            LIMIT 1;
            
            -- Atualizar leilão para finalizado
            UPDATE auctions 
            SET 
                status = 'finished',
                winner_id = winner_user_id,
                winner_name = COALESCE(winner_name, 'Usuário ' || LEFT(winner_user_id::TEXT, 8)),
                finished_at = NOW(),
                time_left = 0,
                updated_at = NOW()
            WHERE id = auction_record.id;
            
            expired_count := expired_count + 1;
            
            RAISE NOTICE 'Leilão % encerrado com sucesso. Ganhador: %', 
                auction_record.id, 
                COALESCE(winner_name, 'Nenhum');
        END;
    END LOOP;
    
    RAISE NOTICE 'Verificação concluída. % leilões encerrados.', expired_count;
END;
$$;

-- Agendar execução da função a cada 5 segundos
SELECT cron.schedule(
    'finalize-expired-auctions',
    '*/5 * * * * *', -- A cada 5 segundos
    'SELECT finalize_expired_auctions();'
);