-- CORREÇÃO DO CRONÔMETRO - Remover conflitos entre sistemas de timer

-- 1. Remover o cron job conflitante que sobrescreve os timers
SELECT cron.unschedule('sync-visual-timers');

-- 2. Limpar ends_at dos leilões ativos para usar apenas time_left
UPDATE public.auctions 
SET 
  ends_at = NULL,
  updated_at = timezone('America/Sao_Paulo', now())
WHERE status = 'active';

-- 3. Log para confirmar as correções
DO $$
DECLARE
  active_auctions_count integer;
BEGIN
  SELECT COUNT(*) INTO active_auctions_count
  FROM public.auctions 
  WHERE status = 'active';
  
  RAISE LOG '✅ [CRONOMETER-FIX] Sistema de cronômetro corrigido:';
  RAISE LOG '   - Cron job conflitante removido: sync-visual-timers';
  RAISE LOG '   - ends_at limpo para % leilões ativos', active_auctions_count;
  RAISE LOG '   - Sistema novo mantido: sync-timers-and-protection + finalize-auctions-by-inactivity';
END $$;