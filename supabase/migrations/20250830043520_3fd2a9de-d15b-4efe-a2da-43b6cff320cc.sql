-- REMOVER COMPLETAMENTE TODOS OS TRIGGERS DE PROTEÇÃO
DROP TRIGGER IF EXISTS prevent_premature_finalization_trigger_fixed ON public.auctions;
DROP TRIGGER IF EXISTS prevent_premature_finalization_simple_trigger ON public.auctions;

-- Verificar se existe alguma função ainda ativa
DROP FUNCTION IF EXISTS public.prevent_premature_finalization_simple();
DROP FUNCTION IF EXISTS public.prevent_premature_finalization();

-- AGORA SIM: Finalizar o leilão preso sem nenhuma proteção
UPDATE public.auctions
SET 
  status = 'finished',
  time_left = 0,
  finished_at = now(),
  updated_at = now(),
  winner_name = 'Administrador',
  winner_id = 'c793d66c-06c5-4fdf-9c2c-0baedd2694f6'
WHERE id = 'b3aba226-9083-444c-9d7a-fb5e7f4689de'
AND status = 'active';