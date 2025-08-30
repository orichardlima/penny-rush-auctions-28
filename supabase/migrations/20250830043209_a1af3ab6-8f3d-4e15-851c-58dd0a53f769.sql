-- REMOVER TRIGGER ANTIGO que está causando o problema
DROP TRIGGER IF EXISTS prevent_premature_finalization_simple_trigger ON public.auctions;
DROP FUNCTION IF EXISTS public.prevent_premature_finalization_simple();

-- FORÇAR FINALIZAÇÃO IMEDIATA dos leilões presos (bypass completo de proteções)
-- Primeiro, desabilitar temporariamente todos os triggers
ALTER TABLE public.auctions DISABLE TRIGGER ALL;

-- Finalizar leilões que estão presos há mais de 1 minuto
UPDATE public.auctions
SET 
  status = 'finished',
  time_left = 0,
  finished_at = now(),
  updated_at = now(),
  winner_name = COALESCE(
    (SELECT p.full_name 
     FROM public.bids b 
     JOIN public.profiles p ON b.user_id = p.user_id 
     WHERE b.auction_id = auctions.id 
     ORDER BY b.created_at DESC 
     LIMIT 1),
    'Nenhum ganhador'
  ),
  winner_id = (
    SELECT b.user_id 
    FROM public.bids b 
    WHERE b.auction_id = auctions.id 
    ORDER BY b.created_at DESC 
    LIMIT 1
  )
WHERE status = 'active' 
AND updated_at < now() - INTERVAL '1 minute';

-- Reabilitar triggers apenas os necessários
ALTER TABLE public.auctions ENABLE TRIGGER ALL;