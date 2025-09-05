-- Remover cron job problemático que chama função inexistente
SELECT cron.unschedule('auction-countdown-timer');

-- Zerar revenue_target do leilão que ainda tem proteção ativa
UPDATE public.auctions 
SET revenue_target = 0.00 
WHERE id = 'b18e86cb-a55c-4741-8613-2dae6d2478bc' OR revenue_target > 0;

-- Log para confirmar limpeza
DO $$
BEGIN
  RAISE LOG 'Sistema de proteção de receita completamente desativado - todos os cron jobs removidos e revenue_targets zerados';
END $$;