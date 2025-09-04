-- 🧹 LIMPEZA DIRECIONADA DOS CRONJOBS REDUNDANTES
-- Remover CronJobs que existem e são problemáticos

-- Remover CronJobs redundantes
SELECT cron.unschedule('auction-expiry-check');
SELECT cron.unschedule('auto-bid-system'); 
SELECT cron.unschedule('finalize-auctions');

-- Manter apenas os essenciais já criados:
-- timer-sync-essential (* * * * *) - OK
-- finalize-auctions-by-inactivity (*/10 * * * * *) - OK  
-- revenue-protection-critical (*/30 * * * * *) - OK

-- Log da limpeza
SELECT 'CronJobs problemáticos removidos' as status;