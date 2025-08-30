-- FINALIZAÇÃO FORÇADA usando UPDATE direto com BYPASS de triggers
-- Forçar finalização do leilão que está preso há 23+ minutos

-- Primeira abordagem: UPDATE direto com winner calculado
UPDATE public.auctions
SET 
  status = 'finished',
  time_left = 0,
  finished_at = now(),
  updated_at = now(),
  winner_name = (
    SELECT COALESCE(p.full_name, 'Usuário ' || SUBSTRING(b.user_id::text FROM 1 FOR 8))
    FROM public.bids b 
    LEFT JOIN public.profiles p ON b.user_id = p.user_id 
    WHERE b.auction_id = 'b3aba226-9083-444c-9d7a-fb5e7f4689de'
    ORDER BY b.created_at DESC 
    LIMIT 1
  ),
  winner_id = (
    SELECT b.user_id 
    FROM public.bids b 
    WHERE b.auction_id = 'b3aba226-9083-444c-9d7a-fb5e7f4689de'
    ORDER BY b.created_at DESC 
    LIMIT 1
  )
WHERE id = 'b3aba226-9083-444c-9d7a-fb5e7f4689de'
AND status = 'active';