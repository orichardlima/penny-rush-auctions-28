-- Remove o job de cron duplicado que está causando lances duplos de bots
-- Mantemos apenas o auto-bid-system que chama a edge function
SELECT cron.unschedule('auto-bid-system-every-30s');

-- Verificar que ainda temos o principal funcionando
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'auto-bid-system';