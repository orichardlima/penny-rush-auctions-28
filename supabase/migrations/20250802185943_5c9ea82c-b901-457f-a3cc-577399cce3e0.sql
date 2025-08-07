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
$function$;