-- ===================================================================
-- CONFIGURAR MONITORAMENTO AUTOMÁTICO COM CRON JOB
-- ===================================================================

-- Verificar se o cron job já existe e removê-lo se necessário
SELECT cron.unschedule('auction-monitor-job');

-- Criar cron job para executar a cada 5 segundos (para máxima precisão)
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
  RAISE LOG '🎯 CRON JOB CONFIGURADO: Monitoramento a cada 5 segundos';
  RAISE LOG '🔗 URL: https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/auction-monitor';
  RAISE LOG '✅ SISTEMA COMPLETO: Webhook único + Encerramento automático';
END $$;