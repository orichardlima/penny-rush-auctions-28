-- Ativar manualmente o leilão "Sem Timer" que deveria ter iniciado
UPDATE public.auctions 
SET 
  status = 'active',
  time_left = 15,
  ends_at = timezone('America/Sao_Paulo', now()) + INTERVAL '15 seconds'
WHERE title = 'Sem Timer' AND status = 'waiting';

-- Verificar o resultado
SELECT id, title, status, time_left, ends_at, starts_at 
FROM public.auctions 
WHERE title = 'Sem Timer';