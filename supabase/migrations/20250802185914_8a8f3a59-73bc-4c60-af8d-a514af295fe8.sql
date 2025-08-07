-- Função para sincronizar timer específico de um leilão
CREATE OR REPLACE FUNCTION public.sync_auction_timer(auction_uuid uuid)
RETURNS TABLE(
  id uuid,
  time_left integer,
  ends_at timestamp with time zone,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Atualizar o time_left baseado no ends_at
  UPDATE public.auctions
  SET 
    time_left = GREATEST(0, EXTRACT(EPOCH FROM (ends_at - NOW()))::integer),
    updated_at = NOW()
  WHERE auctions.id = auction_uuid;
  
  -- Retornar os dados atualizados
  RETURN QUERY
  SELECT 
    auctions.id,
    auctions.time_left,
    auctions.ends_at,
    auctions.status
  FROM public.auctions
  WHERE auctions.id = auction_uuid;
END;
$function$;