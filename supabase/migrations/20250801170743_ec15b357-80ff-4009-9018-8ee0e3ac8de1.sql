-- Atualizar a função do trigger para usar timestamp ao invés de time_left
CREATE OR REPLACE FUNCTION public.update_auction_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Atualizar total de bids, preço e definir novo ends_at
  UPDATE public.auctions
  SET 
    total_bids = total_bids + 1,
    current_price = current_price + bid_increment,
    ends_at = NOW() + INTERVAL '15 seconds',  -- Usar timestamp ao invés de time_left
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
$$;

-- Função para finalizar leilões expirados automaticamente
CREATE OR REPLACE FUNCTION public.finalize_expired_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.auctions
  SET status = 'finished',
      updated_at = now()
  WHERE status = 'active'
    AND ends_at IS NOT NULL
    AND ends_at < NOW();
END;
$$;

-- Atualizar leilões existentes para ter ends_at definido
UPDATE public.auctions 
SET ends_at = NOW() + INTERVAL '15 seconds'
WHERE status = 'active' AND ends_at IS NULL;