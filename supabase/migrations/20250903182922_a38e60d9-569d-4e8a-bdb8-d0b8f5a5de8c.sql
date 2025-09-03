-- Desagendar cron jobs obsoletos usando seus nomes
SELECT cron.unschedule('auto-bid-system-every-second') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-bid-system-every-second');
SELECT cron.unschedule('finalize-expired-auctions-every-second') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-expired-auctions-every-second');
SELECT cron.unschedule('auto-bid-protection') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-bid-protection');

-- Criar novo cron job para sistema de proteção baseado em receita
SELECT cron.schedule(
  'revenue-protection-system',
  '*/10 * * * * *', -- A cada 10 segundos
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/revenue-protection-system',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreWlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
    ),
    body := jsonb_build_object('timestamp', now())
  ) as request_id;
  $$
);

-- Log da implementação
SELECT 'Sistema de proteção baseado em receita implementado - executará a cada 10 segundos' as status;