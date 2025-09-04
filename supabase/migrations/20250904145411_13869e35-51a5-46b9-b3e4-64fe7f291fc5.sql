-- 🧹 LIMPEZA COMPLETA DOS CRONJOBS PROBLEMÁTICOS
-- Remover todos os CronJobs que estão interferindo nos timers

-- 1. Remover o CronJob ultra-fast-revenue-protection (a cada 2s)
SELECT cron.unschedule('ultra-fast-revenue-protection');

-- 2. Remover o CronJob bot-system-smart (função inexistente)
SELECT cron.unschedule('bot-system-smart');

-- 3. Remover o CronJob bot-system-monitor-fixed (redundante)
SELECT cron.unschedule('bot-system-monitor-fixed');

-- 4. Ajustar o timer-sync-system para rodar menos frequentemente
SELECT cron.unschedule('timer-sync-system');

-- 5. Recriar apenas os CronJobs essenciais com intervalos adequados

-- CronJob para sincronização básica (a cada minuto, não a cada 30s)
SELECT cron.schedule(
  'timer-sync-essential',
  '* * * * *', -- A cada 1 minuto
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}',
    body := '{"action": "sync_only"}'
  );
  $$
);

-- CronJob para finalização por inatividade (manter como está)
SELECT cron.schedule(
  'finalize-auctions-by-inactivity',
  '*/10 * * * * *', -- A cada 10 segundos
  $$
  SELECT finalize_auctions_by_inactivity();
  $$
);

-- CronJob para proteção de receita APENAS quando crítico (a cada 30 segundos, não 2s)
SELECT cron.schedule(
  'revenue-protection-critical',
  '*/30 * * * * *', -- A cada 30 segundos
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/revenue-protection-system',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}',
    body := '{"mode": "critical_only"}'
  );
  $$
);