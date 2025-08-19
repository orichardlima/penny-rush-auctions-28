-- Corrigir a função auto_bid_system que deve estar sem search_path

CREATE OR REPLACE FUNCTION public.auto_bid_system()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record record;
  current_revenue integer;
  revenue_percentage decimal;
  bot_id uuid;
BEGIN
  -- Buscar leilões ativos com timer baixo e meta de receita
  FOR auction_record IN 
    SELECT 
      a.id,
      a.time_left,
      a.revenue_target,
      a.current_price,
      a.bid_increment,
      a.bid_cost,
      a.ends_at
    FROM public.auctions a
    WHERE a.status = 'active' 
      AND a.time_left <= 7 
      AND a.time_left > 1 
      AND a.revenue_target > 0
  LOOP
    
    -- Calcular receita atual
    SELECT public.get_auction_revenue(auction_record.id) INTO current_revenue;
    
    -- Calcular porcentagem da meta
    revenue_percentage := (current_revenue::decimal / auction_record.revenue_target::decimal) * 100;
    
    -- Se receita < 80% da meta, ativar bot
    IF revenue_percentage < 80 THEN
      RAISE LOG 'Bot intervention triggered for auction %: revenue %/% (%.1f%%)', 
        auction_record.id, current_revenue, auction_record.revenue_target, revenue_percentage;
      
      -- Obter bot
      SELECT public.get_random_bot() INTO bot_id;
      
      -- Inserir lance do bot
      INSERT INTO public.bids (auction_id, user_id, bid_amount, cost_paid)
      VALUES (auction_record.id, bot_id, auction_record.current_price + auction_record.bid_increment, auction_record.bid_cost);
      
      RAISE LOG 'Bot % placed bid on auction %', bot_id, auction_record.id;
    END IF;
  END LOOP;
  
  RAISE LOG 'Auto-bid system check completed';
END;
$function$;