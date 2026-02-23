-- Primeiro remover o job antigo e recriar com 1 minuto
SELECT cron.unschedule('sync-timers-and-protection');

SELECT cron.schedule(
  'sync-timers-and-protection',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);