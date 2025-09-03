-- 🚨 CORREÇÃO URGENTE: Sistema de Timer Anti-Timeout

-- 1. LIMPAR TODOS OS CRON JOBS CONFLITANTES
SELECT cron.unschedule('revenue-protection-system') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revenue-protection-system');
SELECT cron.unschedule('sync-timers-and-protection') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-timers-and-protection');
SELECT cron.unschedule('auto-bid-system-every-second') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-bid-system-every-second');
SELECT cron.unschedule('finalize-expired-auctions-every-second') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-expired-auctions-every-second');
SELECT cron.unschedule('auto-bid-protection') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-bid-protection');
SELECT cron.unschedule('sync-auction-timers') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-auction-timers');
SELECT cron.unschedule('finalize-auction-system') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-auction-system');
SELECT cron.unschedule('bot-bid-system') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-bid-system');

-- 2. CRIAR SISTEMA ULTRA-RÁPIDO DE PROTEÇÃO (A CADA 2 SEGUNDOS)
SELECT cron.schedule(
  'ultra-fast-revenue-protection',
  '*/2 * * * * *', -- A CADA 2 SEGUNDOS
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/revenue-protection-system',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
    ),
    body := jsonb_build_object('emergency_mode', true)
  ) as request_id;
  $$
);

-- 3. CRIAR SISTEMA DE SINCRONIZAÇÃO GERAL (A CADA 30 SEGUNDOS)
SELECT cron.schedule(
  'timer-sync-system',
  '*/30 * * * * *', -- A CADA 30 SEGUNDOS
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreWlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
    ),
    body := jsonb_build_object('sync_mode', true)
  ) as request_id;
  $$
);

-- Log final
SELECT '🚨 SISTEMA DE TIMER CORRIGIDO: Ultra-Fast Protection (2s) + Timer Sync (30s)' as status;