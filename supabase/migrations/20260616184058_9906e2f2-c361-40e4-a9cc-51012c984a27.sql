-- 1) Padrão de created_at em bids: clock_timestamp() para refletir horário real do INSERT
ALTER TABLE public.bids ALTER COLUMN created_at SET DEFAULT clock_timestamp();

-- 2) update_auction_on_bid: usar NEW.created_at como last_bid_at
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

  IF v_auction.status <> 'active' THEN
    RETURN NEW;
  END IF;

  v_bid_increment := COALESCE(v_auction.bid_increment, 0.01);
  v_bid_cost := COALESCE(v_auction.bid_cost, 1.50);

  SELECT COALESCE(is_bot, false) INTO v_is_bot
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  UPDATE public.auctions
  SET
    current_price = COALESCE(current_price, COALESCE(starting_price, 0)) + v_bid_increment,
    total_bids = COALESCE(total_bids, 0) + 1,
    company_revenue = COALESCE(company_revenue, 0) +
      CASE WHEN NEW.cost_paid > 0 AND NOT v_is_bot THEN v_bid_cost ELSE 0 END,
    time_left = 15,
    -- CRÍTICO: usar o horário do próprio lance para casar com o nome que sobe no topo
    last_bid_at = GREATEST(COALESCE(last_bid_at, NEW.created_at), NEW.created_at),
    updated_at = clock_timestamp(),
    scheduled_bot_bid_at = NULL,
    scheduled_bot_band = NULL
  WHERE id = NEW.auction_id;

  RETURN NEW;
END;
$function$;

-- 3) rebuild_auction_last_bidders: reconstrução pura por created_at desc (sem privilegiar bot/real)
CREATE OR REPLACE FUNCTION public.rebuild_auction_last_bidders(p_auction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bidders jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(display_name ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_bidders
  FROM (
    SELECT
      b.created_at,
      CASE
        WHEN p.full_name IS NULL OR btrim(p.full_name) = '' THEN 'Usuário'
        WHEN array_length(string_to_array(btrim(p.full_name), ' '), 1) >= 2
          THEN (string_to_array(btrim(p.full_name), ' '))[1] || ' ' || (string_to_array(btrim(p.full_name), ' '))[2]
        ELSE (string_to_array(btrim(p.full_name), ' '))[1]
      END AS display_name
    FROM public.bids b
    LEFT JOIN public.profiles p ON p.user_id = b.user_id
    WHERE b.auction_id = p_auction_id
    ORDER BY b.created_at DESC
    LIMIT 3
  ) sub;

  UPDATE public.auctions
  SET last_bidders = v_bidders
  WHERE id = p_auction_id;

  RETURN v_bidders;
END;
$function$;