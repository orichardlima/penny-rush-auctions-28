-- CORREÇÃO URGENTE FINAL - SISTEMA DE LEILÕES
-- Eliminar conflitos e unificar lógica

-- FASE 1: PARADA DE EMERGÊNCIA - Desativar todos os cron jobs antigos
SELECT cron.unschedule('sync-auction-timers-every-second') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-auction-timers-every-second');
SELECT cron.unschedule('finalize-expired-auctions-every-5-seconds') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-expired-auctions-every-5-seconds');
SELECT cron.unschedule('auto-finalize-inactive-auctions-every-10-seconds') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-finalize-inactive-auctions-every-10-seconds');
SELECT cron.unschedule('auto-bid-system-every-3-seconds') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-bid-system-every-3-seconds');
SELECT cron.unschedule('sync-auction-timers-every-2-seconds') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-auction-timers');
SELECT cron.unschedule('resurrect-incorrectly-finished-auctions-every-30-seconds') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'resurrect-incorrectly-finished-auctions-every-30-seconds');
SELECT cron.unschedule('fix-stuck-auctions-every-60-seconds') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fix-stuck-auctions-every-60-seconds');

-- FASE 2: REMOVER TODOS OS TRIGGERS EXISTENTES
DROP TRIGGER IF EXISTS update_auction_stats_trigger ON public.bids;
DROP TRIGGER IF EXISTS update_auction_stats_simple_trigger ON public.bids;
DROP TRIGGER IF EXISTS prevent_premature_finalization_trigger ON public.auctions;
DROP TRIGGER IF EXISTS prevent_premature_finalization_simple_trigger ON public.auctions;

-- FASE 3: LIMPEZA DE FUNÇÕES CONFLITANTES
DROP FUNCTION IF EXISTS public.finalize_expired_auctions();
DROP FUNCTION IF EXISTS public.sync_auction_timer(uuid);
DROP FUNCTION IF EXISTS public.auto_finalize_inactive_auctions();
DROP FUNCTION IF EXISTS public.sync_auction_timers();
DROP FUNCTION IF EXISTS public.resurrect_incorrectly_finished_auctions();
DROP FUNCTION IF EXISTS public.fix_stuck_auctions();
DROP FUNCTION IF EXISTS public.auto_bid_system();
DROP PROCEDURE IF EXISTS public.auto_bid_system_procedure();

-- FASE 4: RESET DOS LEILÕES ATIVOS COM TIMERS INCORRETOS
UPDATE public.auctions 
SET 
  time_left = 15,
  ends_at = NULL,
  updated_at = timezone('America/Sao_Paulo', now())
WHERE status = 'active';

-- FASE 5: CRIAR TRIGGERS CORRETOS
CREATE TRIGGER update_auction_stats_simple_trigger
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auction_stats_simple();

CREATE TRIGGER prevent_premature_finalization_simple_trigger
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_premature_finalization_simple();

-- FASE 6: CONFIGURAR APENAS OS 2 CRON JOBS NECESSÁRIOS
SELECT cron.unschedule('finalize-auctions-by-inactivity') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-auctions-by-inactivity');
SELECT cron.unschedule('sync-visual-timers') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-visual-timers');

SELECT cron.schedule(
  'finalize-auctions-by-inactivity',
  '*/10 * * * *',
  $$SELECT public.finalize_auctions_by_inactivity();$$
);

SELECT cron.schedule(
  'sync-visual-timers',
  '*/2 * * * *',
  $$SELECT public.sync_auction_timers_visual();$$
);