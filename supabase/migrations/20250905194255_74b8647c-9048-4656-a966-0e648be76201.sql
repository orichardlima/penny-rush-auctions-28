-- Create cron job for timer protection every 5 seconds
SELECT cron.schedule(
  'timer-protection-job',
  '*/5 * * * * *', -- Every 5 seconds
  $$
  SELECT
    net.http_post(
        url:='https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/timer-protection',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb
    ) as request_id;
  $$
);

-- Log the timer protection system activation
DO $$
BEGIN
  RAISE LOG '⏰ [TIMER-PROTECTION] Sistema de proteção de timer ativado - executando a cada 5 segundos';
END $$;