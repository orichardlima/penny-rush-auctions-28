-- Desativar cron jobs que estão causando sincronização dos timers
-- Remover todos os cron jobs existentes relacionados ao sync-timers-and-protection

-- Primeiro, listar os cron jobs existentes para verificar quais estão ativos
SELECT * FROM cron.job;

-- Desativar o cron job de sync-timers-and-protection que roda a cada 5 segundos
-- Isso vai parar a sincronização forçada de todos os timers
DELETE FROM cron.job WHERE jobname LIKE '%sync-timer%' OR jobname LIKE '%protection%';

-- Também remover jobs relacionados ao auto_bid_system que podem estar causando problemas
DELETE FROM cron.job WHERE jobname LIKE '%auto-bid%' OR jobname LIKE '%bid-system%';

-- Manter apenas os triggers individuais que resetam os timers quando há bids
-- Os triggers já estão funcionando corretamente para bids individuais

-- Log da mudança
DO $$
BEGIN
  RAISE LOG 'CORREÇÃO TIMERS: Cron jobs de sincronização desativados - timers agora são individuais por bid';
END $$;