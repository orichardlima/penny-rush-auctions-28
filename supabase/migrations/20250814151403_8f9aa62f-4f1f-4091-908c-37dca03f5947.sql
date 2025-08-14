-- ATUALIZAR FUNÇÕES SQL PARA TRABALHAR DIRETAMENTE EM REAIS
-- Remover todas as divisões por 100 das funções existentes

-- 1. Atualizar função get_financial_summary
CREATE OR REPLACE FUNCTION public.get_financial_summary()
 RETURNS TABLE(total_revenue numeric, auction_revenue numeric, package_revenue numeric, total_auctions integer, active_auctions integer, finished_auctions integer, total_users integer, paying_users integer, average_auction_revenue numeric, total_bids integer, user_bids integer, bot_bids integer, conversion_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (
      COALESCE((SELECT SUM(company_revenue) FROM public.auctions), 0) +
      COALESCE((SELECT SUM(amount_paid) FROM public.bid_purchases WHERE payment_status = 'completed'), 0)
    ) as total_revenue,
    COALESCE((SELECT SUM(company_revenue) FROM public.auctions), 0) as auction_revenue,
    COALESCE((SELECT SUM(amount_paid) FROM public.bid_purchases WHERE payment_status = 'completed'), 0) as package_revenue,
    (SELECT COUNT(*) FROM public.auctions)::integer as total_auctions,
    (SELECT COUNT(*) FROM public.auctions WHERE status = 'active')::integer as active_auctions,
    (SELECT COUNT(*) FROM public.auctions WHERE status = 'finished')::integer as finished_auctions,
    (SELECT COUNT(*) FROM public.profiles WHERE is_bot = false)::integer as total_users,
    (SELECT COUNT(DISTINCT user_id) FROM public.bid_purchases WHERE payment_status = 'completed')::integer as paying_users,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.auctions WHERE status = 'finished') > 0 
      THEN (SELECT AVG(company_revenue) FROM public.auctions WHERE status = 'finished')
      ELSE 0::decimal
    END as average_auction_revenue,
    (SELECT COUNT(*) FROM public.bids)::integer as total_bids,
    (
      SELECT COUNT(*) 
      FROM public.bids b 
      JOIN public.profiles p ON b.user_id = p.user_id 
      WHERE COALESCE(p.is_bot, false) = false
    )::integer as user_bids,
    (
      SELECT COUNT(*) 
      FROM public.bids b 
      JOIN public.profiles p ON b.user_id = p.user_id 
      WHERE p.is_bot = true
    )::integer as bot_bids,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.profiles WHERE is_bot = false) > 0
      THEN ROUND(
        ((SELECT COUNT(DISTINCT user_id) FROM public.bid_purchases WHERE payment_status = 'completed')::decimal / 
         (SELECT COUNT(*) FROM public.profiles WHERE is_bot = false)::decimal) * 100, 2
      )
      ELSE 0::decimal
    END as conversion_rate;
END;
$function$;

-- 2. Atualizar função get_revenue_trends
CREATE OR REPLACE FUNCTION public.get_revenue_trends()
 RETURNS TABLE(date_period date, auction_revenue numeric, package_revenue numeric, total_revenue numeric, bids_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '29 days',
      CURRENT_DATE,
      '1 day'::interval
    )::date AS date_period
  ),
  auction_daily AS (
    SELECT 
      DATE(b.created_at) as bid_date,
      SUM(b.cost_paid) as daily_auction_revenue,
      COUNT(*) as daily_bids
    FROM public.bids b
    JOIN public.profiles p ON b.user_id = p.user_id
    WHERE COALESCE(p.is_bot, false) = false
      AND b.created_at >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY DATE(b.created_at)
  ),
  package_daily AS (
    SELECT 
      DATE(bp.created_at) as purchase_date,
      SUM(bp.amount_paid) as daily_package_revenue
    FROM public.bid_purchases bp
    WHERE bp.payment_status = 'completed'
      AND bp.created_at >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY DATE(bp.created_at)
  )
  SELECT 
    ds.date_period,
    COALESCE(ad.daily_auction_revenue, 0) as auction_revenue,
    COALESCE(pd.daily_package_revenue, 0) as package_revenue,
    COALESCE(ad.daily_auction_revenue, 0) + COALESCE(pd.daily_package_revenue, 0) as total_revenue,
    COALESCE(ad.daily_bids, 0)::integer as bids_count
  FROM date_series ds
  LEFT JOIN auction_daily ad ON ds.date_period = ad.bid_date
  LEFT JOIN package_daily pd ON ds.date_period = pd.purchase_date
  ORDER BY ds.date_period;
END;
$function$;

-- 3. Atualizar função update_auction_stats para trabalhar em reais
CREATE OR REPLACE FUNCTION public.update_auction_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  utc_now timestamptz;
  new_ends_at timestamptz;
  is_bot_user boolean := false;
BEGIN
  -- Use UTC consistently
  utc_now := now();
  
  -- Calculate new end time with 16-second buffer to ensure 15 seconds minimum
  new_ends_at := utc_now + INTERVAL '16 seconds';
  
  -- Verificar se o usuário é um bot
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  -- Update auction stats
  IF is_bot_user THEN
    -- Bot lance: incrementa current_price e total_bids, mas NÃO incrementa company_revenue
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      ends_at = new_ends_at,
      time_left = 15,
      updated_at = utc_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG 'Bot bid placed on auction %: timer reset to 15 seconds, ends_at set to %, NO revenue added', 
      NEW.auction_id, new_ends_at;
  ELSE
    -- Usuário real: incrementa current_price, total_bids E company_revenue (agora diretamente em reais)
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost, -- agora já está em reais
      ends_at = new_ends_at,
      time_left = 15,
      updated_at = utc_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG 'User bid placed on auction %: timer reset to 15 seconds, ends_at set to %, revenue increased by R$%.2f', 
      NEW.auction_id, new_ends_at, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;