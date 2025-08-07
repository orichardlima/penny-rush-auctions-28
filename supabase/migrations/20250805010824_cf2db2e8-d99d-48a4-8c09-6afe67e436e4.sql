-- Criar o cron job para sync-timers-and-protection
-- Verificar se já existe o cron job antes de criar
SELECT cron.unschedule('sync-timers-and-protection') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-timers-and-protection'
);

-- Criar o cron job rodando a cada 5 segundos
SELECT cron.schedule(
  'sync-timers-and-protection',
  '*/5 * * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) as request_id;
  $$
);