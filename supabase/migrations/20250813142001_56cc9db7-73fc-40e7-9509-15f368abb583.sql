-- ===================================================================
-- CORREÇÃO: PROBLEMAS IDENTIFICADOS E SOLUÇÕES
-- ===================================================================

-- PROBLEMA 1: TRIGGERS DUPLICADOS NA TABELA BIDS (causando incremento duplo)
-- Existe 'tr_update_auction_stats_on_bid' e 'trg_bids_update_stats' fazendo a mesma coisa
-- Também existe 'tr_prevent_invalid_bids' e 'trg_bids_prevent_inactive' duplicados

-- PROBLEMA 2: CRON JOBS MÚLTIPLOS tentando chamar funções que não existem

-- SOLUÇÃO: Remover triggers duplicados e cron jobs quebrados
DROP TRIGGER IF EXISTS trg_bids_update_stats ON public.bids;
DROP TRIGGER IF EXISTS trg_bids_prevent_inactive ON public.bids;

-- Remover cron jobs que estão chamando funções inexistentes
SELECT cron.unschedule('cleanup-expired-auctions');
SELECT cron.unschedule('cleanup-expired-auctions-10s');  
SELECT cron.unschedule('finalize-expired-auctions');
SELECT cron.unschedule('cleanup-orphaned-auctions');

-- VERIFICAR se a função auto_finalize_inactive_auctions está sendo chamada
-- O cron job auction-monitor-job deveria estar funcionando a cada 5 segundos

-- Logs de correção
DO $$
BEGIN
  RAISE LOG '✅ TRIGGERS DUPLICADOS REMOVIDOS: trg_bids_update_stats, trg_bids_prevent_inactive';
  RAISE LOG '✅ CRON JOBS QUEBRADOS REMOVIDOS: cleanup-expired-auctions, finalize-expired-auctions, etc';
  RAISE LOG '🔧 INCREMENTO DEVE VOLTAR AO NORMAL: Apenas 1 trigger atualizando stats';
  RAISE LOG '🕐 ENCERRAMENTO AUTOMÁTICO: auction-monitor-job deve estar funcionando a cada 5s';
END $$;