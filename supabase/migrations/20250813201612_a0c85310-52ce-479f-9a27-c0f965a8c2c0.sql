-- Criar função para fechar leilão imediatamente quando timer chega a zero
CREATE OR REPLACE FUNCTION public.force_close_auction(auction_uuid uuid)
RETURNS TABLE(id uuid, status text, time_left integer, winner_id uuid, winner_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  auction_data RECORD;
  last_bidder_id UUID;
  last_bidder_name TEXT;
  utc_now TIMESTAMPTZ;
BEGIN
  utc_now := NOW();
  
  -- Buscar dados do leilão
  SELECT a.id, a.status, a.time_left, a.ends_at
  INTO auction_data
  FROM public.auctions a
  WHERE a.id = auction_uuid;
  
  -- Se leilão não existe ou já está finalizado, retornar sem fazer nada
  IF auction_data.id IS NULL OR auction_data.status = 'finished' THEN
    RETURN QUERY
    SELECT a.id, a.status, a.time_left, a.winner_id, a.winner_name
    FROM public.auctions a
    WHERE a.id = auction_uuid;
    RETURN;
  END IF;
  
  -- Só fechar se o leilão realmente expirou (ends_at passou)
  IF auction_data.ends_at IS NOT NULL AND auction_data.ends_at <= utc_now THEN
    
    RAISE LOG '⚡ [FORCE-CLOSE] Fechando leilão % imediatamente', auction_uuid;
    
    -- Buscar último lance para determinar ganhador
    SELECT b.user_id, p.full_name
    INTO last_bidder_id, last_bidder_name
    FROM public.bids b
    LEFT JOIN public.profiles p ON b.user_id = p.user_id
    WHERE b.auction_id = auction_uuid
    ORDER BY b.created_at DESC
    LIMIT 1;
    
    -- Definir nome do ganhador
    IF last_bidder_name IS NOT NULL AND trim(last_bidder_name) != '' THEN
      last_bidder_name := last_bidder_name;
    ELSIF last_bidder_id IS NOT NULL THEN
      last_bidder_name := 'Usuário ' || SUBSTRING(last_bidder_id::text FROM 1 FOR 8);
    ELSE
      last_bidder_name := 'Nenhum ganhador';
      last_bidder_id := NULL;
    END IF;
    
    -- FECHAR LEILÃO IMEDIATAMENTE
    UPDATE public.auctions
    SET 
      status = 'finished',
      time_left = 0,
      winner_id = last_bidder_id,
      winner_name = last_bidder_name,
      finished_at = utc_now,
      updated_at = utc_now
    WHERE id = auction_uuid;
    
    RAISE LOG '✅ [FORCE-CLOSE] Leilão % fechado! Ganhador: %', auction_uuid, last_bidder_name;
  ELSE
    RAISE LOG '⏰ [FORCE-CLOSE] Leilão % ainda não expirou - aguardando', auction_uuid;
  END IF;
  
  -- Retornar dados atualizados
  RETURN QUERY
  SELECT a.id, a.status, a.time_left, a.winner_id, a.winner_name
  FROM public.auctions a
  WHERE a.id = auction_uuid;
  
END;
$$;