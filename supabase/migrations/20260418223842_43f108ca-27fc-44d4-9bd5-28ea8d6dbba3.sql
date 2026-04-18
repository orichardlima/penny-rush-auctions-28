-- Remover a lógica de last_bidders do trigger antigo update_auction_on_bid.
-- O trigger bids_refresh_last_bidders (rebuild_auction_last_bidders) torna-se a única fonte de verdade.
-- Isso elimina a race condition que causava duplicação do primeiro nome.

CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auction RECORD;
  v_bid_increment NUMERIC;
  v_bid_cost NUMERIC;
  v_is_bot BOOLEAN;
BEGIN
  SELECT * INTO v_auction FROM public.auctions WHERE id = NEW.auction_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  IF v_auction.status != 'active' THEN
    RETURN NEW;
  END IF;
  
  v_bid_increment := COALESCE(v_auction.bid_increment, 0.01);
  v_bid_cost := COALESCE(v_auction.bid_cost, 1.50);
  
  SELECT COALESCE(is_bot, false) INTO v_is_bot
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  -- Atualiza apenas campos numéricos/temporais; NÃO toca em last_bidders.
  -- last_bidders é gerenciado exclusivamente pelo trigger bids_refresh_last_bidders.
  UPDATE public.auctions 
  SET 
    current_price = COALESCE(current_price, COALESCE(starting_price, 0)) + v_bid_increment,
    total_bids = COALESCE(total_bids, 0) + 1,
    company_revenue = COALESCE(company_revenue, 0) + 
      CASE WHEN NEW.cost_paid > 0 AND NOT v_is_bot THEN v_bid_cost ELSE 0 END,
    time_left = 15,
    last_bid_at = NOW(),
    updated_at = NOW(),
    scheduled_bot_bid_at = NULL,
    scheduled_bot_band = NULL
  WHERE id = NEW.auction_id;
  
  RETURN NEW;
END;
$function$;

-- Corrigir os leilões ativos atuais que já estão com last_bidders duplicado,
-- reconstruindo a partir do histórico real em bids.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.auctions WHERE status = 'active' LOOP
    PERFORM public.rebuild_auction_last_bidders(r.id);
  END LOOP;
END $$;