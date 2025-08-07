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
$function$

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
$function$

-- Modificar trigger para garantir sincronização adequada
CREATE OR REPLACE FUNCTION public.update_auction_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Atualizar total de bids, preço e definir novo ends_at
  UPDATE public.auctions
  SET 
    total_bids = total_bids + 1,
    current_price = current_price + bid_increment,
    ends_at = NOW() + INTERVAL '15 seconds',
    time_left = 15, -- Resetar para 15 segundos
    updated_at = now()
  WHERE id = NEW.auction_id;
  
  -- Se o leilão atingiu a meta de proteção, desativar proteção
  UPDATE public.auctions
  SET protected_mode = false
  WHERE id = NEW.auction_id 
    AND protected_mode = true
    AND protected_target > 0
    AND (
      SELECT COALESCE(SUM(cost_paid), 0)
      FROM public.bids
      WHERE auction_id = NEW.auction_id
    ) >= protected_target;
  
  RETURN NEW;
END;
$function$

-- Habilitar realtime para a tabela auctions
ALTER TABLE public.auctions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;