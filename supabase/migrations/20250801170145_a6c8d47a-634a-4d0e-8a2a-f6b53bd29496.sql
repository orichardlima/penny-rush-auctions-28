-- Atualizar a função do trigger para gerenciar o time_left
CREATE OR REPLACE FUNCTION public.update_auction_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Atualizar total de bids, preço e resetar timer
  UPDATE public.auctions
  SET 
    total_bids = total_bids + 1,
    current_price = current_price + bid_increment,
    time_left = 15,  -- Reset timer para 15 segundos
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

-- Criar o trigger se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_auction_stats'
  ) THEN
    CREATE TRIGGER trigger_update_auction_stats
      AFTER INSERT ON public.bids
      FOR EACH ROW
      EXECUTE FUNCTION public.update_auction_stats();
  END IF;
END $$;