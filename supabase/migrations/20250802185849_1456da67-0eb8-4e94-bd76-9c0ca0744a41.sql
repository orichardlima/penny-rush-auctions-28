-- Função para atualizar timers de leilões ativos
CREATE OR REPLACE FUNCTION public.update_auction_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Atualizar time_left para todos os leilões ativos baseado em ends_at
  UPDATE public.auctions
  SET 
    time_left = GREATEST(0, EXTRACT(EPOCH FROM (ends_at - NOW()))::integer),
    updated_at = NOW()
  WHERE status = 'active' 
    AND ends_at IS NOT NULL;
    
  -- Finalizar leilões que expiraram
  UPDATE public.auctions
  SET 
    status = 'finished',
    time_left = 0,
    updated_at = NOW()
  WHERE status = 'active'
    AND ends_at IS NOT NULL
    AND ends_at <= NOW();
END;
$function$;