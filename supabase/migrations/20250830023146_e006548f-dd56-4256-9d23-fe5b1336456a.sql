-- CORREÇÃO DEFINITIVA COMPLETA - LIMPEZA TOTAL DE CRON JOBS ÓRFÃOS
-- Remover TODOS os cron jobs órfãos que causam erros constantes

-- 1. Limpar todos os cron jobs existentes (órfãos)
DELETE FROM cron.job WHERE command LIKE '%auto_bid_system%';
DELETE FROM cron.job WHERE command LIKE '%finalize_expired_auctions%';
DELETE FROM cron.job WHERE command LIKE '%auto_bid_system_procedure%';

-- 2. Manter apenas os cron jobs essenciais e funcionais
-- Cron para sincronização de timers (a cada 5 minutos - otimizado)
SELECT cron.schedule(
  'sync-timers-protection',
  '*/5 * * * *',
  $$
  select
    net.http_post(
        url:='https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- 3. Cron para finalização por inatividade (a cada 10 minutos)
SELECT cron.schedule(
  'finalize-by-inactivity',
  '*/10 * * * *',
  $$
  SELECT public.finalize_auctions_by_inactivity();
  $$
);

-- 4. Criar leilão teste para verificar funcionamento IMEDIATO
INSERT INTO public.auctions (
  title,
  description,
  starting_price,
  current_price,
  bid_increment,
  bid_cost,
  market_value,
  revenue_target,
  image_url,
  status,
  starts_at,
  time_left
) VALUES (
  'TESTE CORREÇÃO DEFINITIVA - iPhone 15 Pro',
  'Leilão teste para verificar se o sistema está funcionando perfeitamente após correção completa',
  1.00,
  1.00,
  0.01,
  1.00,
  5000.00,
  500.00,
  '/placeholder.svg',
  'waiting',
  timezone('America/Sao_Paulo', now()) + INTERVAL '1 minute',
  15
);