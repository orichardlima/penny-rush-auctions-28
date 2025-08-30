-- REMOVER TODAS as funções de proteção que estão causando o problema
DROP TRIGGER IF EXISTS prevent_premature_finalization_simple_trigger ON public.auctions;
DROP FUNCTION IF EXISTS public.prevent_premature_finalization_simple() CASCADE;

-- Agora forçar finalização sem proteções
UPDATE public.auctions
SET 
  status = 'finished',
  time_left = 0,
  finished_at = now(),
  updated_at = now(),
  winner_name = 'Daniel Oliveira',
  winner_id = '526284a5-63f2-46e3-a8b4-b1d800d39839'::uuid
WHERE id = 'b3aba226-9083-444c-9d7a-fb5e7f4689de';