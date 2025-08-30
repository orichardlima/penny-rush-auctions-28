-- LIMPEZA COMPLETA DO SISTEMA DE LEILÕES

-- 1. REMOVER CRON JOBS ÓRFÃOS que chamam funções inexistentes
SELECT cron.unschedule('auto_bid_system') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto_bid_system'
);

SELECT cron.unschedule('auto_bid_system_procedure') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto_bid_system_procedure'
);

SELECT cron.unschedule('finalize_expired_auctions') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'finalize_expired_auctions'
);

-- 2. REMOVER TRIGGER DUPLICADO (manter apenas update_auction_stats_simple_trigger)
DROP TRIGGER IF EXISTS tr_update_auction_stats_on_bid ON public.bids;

-- 3. VERIFICAR E GARANTIR QUE O TRIGGER CORRETO EXISTE
DROP TRIGGER IF EXISTS update_auction_stats_simple_trigger ON public.bids;
CREATE TRIGGER update_auction_stats_simple_trigger
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auction_stats_simple();

-- 4. CRIAR LEILÃO DE TESTE para verificar funcionamento completo
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  bid_increment,
  bid_cost,
  market_value,
  revenue_target,
  status,
  starts_at,
  time_left,
  created_at,
  updated_at
) VALUES (
  'Teste Sistema Cronômetro',
  'Leilão de teste para verificar funcionamento do cronômetro após correções',
  'https://tlcdidkkxigofdhxnzzo.supabase.co/storage/v1/object/public/auction-images/iphone-15-pro.jpg',
  1.00,
  1.00,
  0.01,
  1.00,
  500.00,
  50.00,
  'waiting',
  timezone('America/Sao_Paulo', now()) + INTERVAL '1 minute', -- Inicia em 1 minuto
  15,
  timezone('America/Sao_Paulo', now()),
  timezone('America/Sao_Paulo', now())
);

-- 5. LOG DA LIMPEZA
DO $$
BEGIN
  RAISE LOG '🧹 [CLEANUP] Sistema limpo: cron jobs órfãos removidos, triggers duplicados corrigidos, leilão teste criado';
END $$;