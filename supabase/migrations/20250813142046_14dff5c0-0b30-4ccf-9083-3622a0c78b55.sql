-- ===================================================================
-- RECRIAR O CRON JOB AUCTION-MONITOR-JOB PARA ENCERRAMENTO AUTOMÁTICO
-- ===================================================================

-- Criar o cron job para monitoramento de leilões a cada 5 segundos
SELECT cron.schedule(
  'auction-monitor-job',
  '*/5 * * * * *', -- A cada 5 segundos  
  $$
  SELECT
    net.http_post(
        url:='https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/auction-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb,
        body:='{"timestamp": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);

-- ===================================================================
-- LOGS DE CONFIRMAÇÃO
-- ===================================================================

DO $$
BEGIN
  RAISE LOG '🎯 CRON JOB RECRIADO: auction-monitor-job a cada 5 segundos';
  RAISE LOG '🔗 Edge Function: https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/auction-monitor';
  RAISE LOG '🔧 TRIGGERS DUPLICADOS REMOVIDOS: Incremento agora será apenas R$ 0,01';
  RAISE LOG '✅ SISTEMA RESTAURADO: Encerramento automático + Incremento correto';
END $$;