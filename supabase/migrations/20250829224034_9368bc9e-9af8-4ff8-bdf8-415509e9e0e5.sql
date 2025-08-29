-- CORREÇÃO DO CRONÔMETRO - Limpar ends_at para usar apenas time_left

-- Limpar ends_at dos leilões ativos para usar apenas time_left
UPDATE public.auctions 
SET 
  ends_at = NULL,
  updated_at = timezone('America/Sao_Paulo', now())
WHERE status = 'active';

-- Log para confirmar as correções
DO $$
DECLARE
  active_auctions_count integer;
BEGIN
  SELECT COUNT(*) INTO active_auctions_count
  FROM public.auctions 
  WHERE status = 'active';
  
  RAISE LOG '✅ [CRONOMETER-FIX] Sistema de cronômetro corrigido:';
  RAISE LOG '   - ends_at limpo para % leilões ativos', active_auctions_count;
  RAISE LOG '   - Sistema usando apenas time_left decrementado pelos cron jobs';
  RAISE LOG '   - Cronômetros devem voltar a funcionar normalmente';
END $$;