-- Limpar cron jobs obsoletos que chamam funções inexistentes
DELETE FROM cron.job WHERE command LIKE '%auto_bid_system%' OR command LIKE '%finalize_expired_auctions%';

-- Criar novo cron job para sistema de proteção baseado em receita
SELECT cron.schedule(
  'revenue-protection-system',
  '*/10 * * * * *', -- A cada 10 segundos
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/revenue-protection-system',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
    ),
    body := jsonb_build_object('timestamp', now())
  ) as request_id;
  $$
);

-- Log da implementação
SELECT 'Sistema de proteção baseado em receita implementado com sucesso' as status;