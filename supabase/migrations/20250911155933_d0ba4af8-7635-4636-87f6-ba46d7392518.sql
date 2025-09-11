-- Finalizar leilões presos (com last_bid_at muito antigo)
UPDATE public.auctions 
SET 
  status = 'finished',
  finished_at = timezone('America/Sao_Paulo', now()),
  time_left = 0,
  winner_id = (
    SELECT user_id 
    FROM public.bids 
    WHERE auction_id = auctions.id 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  winner_name = (
    SELECT p.full_name 
    FROM public.bids b
    JOIN public.profiles p ON b.user_id = p.user_id
    WHERE b.auction_id = auctions.id 
    ORDER BY b.created_at DESC 
    LIMIT 1
  ),
  updated_at = timezone('America/Sao_Paulo', now())
WHERE status = 'active' 
  AND (
    last_bid_at IS NULL 
    OR last_bid_at < timezone('America/Sao_Paulo', now()) - INTERVAL '30 seconds'
  );

-- Log da operação
DO $$
DECLARE
  affected_count integer;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE LOG '🔧 [CLEANUP] Finalizados % leilões presos por inatividade', affected_count;
END $$;