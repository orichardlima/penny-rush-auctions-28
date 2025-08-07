-- Create comprehensive financial analytics functions

-- Function to get detailed auction financials
CREATE OR REPLACE FUNCTION public.get_auction_financials(auction_uuid uuid)
RETURNS TABLE(
  auction_id uuid,
  title text,
  total_bids_count integer,
  user_bids_count integer,
  bot_bids_count integer,
  user_bids_percentage decimal,
  bot_bids_percentage decimal,
  real_revenue decimal,
  revenue_target integer,
  target_percentage decimal,
  current_price integer,
  market_value integer,
  roi_percentage decimal,
  profit_margin decimal,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as auction_id,
    a.title,
    a.total_bids as total_bids_count,
    COALESCE(user_stats.user_bids, 0)::integer as user_bids_count,
    COALESCE(bot_stats.bot_bids, 0)::integer as bot_bids_count,
    CASE 
      WHEN a.total_bids > 0 THEN ROUND((COALESCE(user_stats.user_bids, 0)::decimal / a.total_bids::decimal) * 100, 2)
      ELSE 0::decimal
    END as user_bids_percentage,
    CASE 
      WHEN a.total_bids > 0 THEN ROUND((COALESCE(bot_stats.bot_bids, 0)::decimal / a.total_bids::decimal) * 100, 2)
      ELSE 0::decimal
    END as bot_bids_percentage,
    a.company_revenue as real_revenue,
    a.revenue_target,
    CASE 
      WHEN a.revenue_target > 0 THEN ROUND((a.company_revenue / a.revenue_target::decimal) * 100, 2)
      ELSE 0::decimal
    END as target_percentage,
    a.current_price,
    a.market_value,
    CASE 
      WHEN a.market_value > 0 THEN ROUND((a.company_revenue / (a.market_value / 100.0)) * 100, 2)
      ELSE 0::decimal
    END as roi_percentage,
    (a.company_revenue - (a.market_value / 100.0)) as profit_margin,
    a.status
  FROM public.auctions a
  LEFT JOIN (
    SELECT 
      b.auction_id,
      COUNT(*) as user_bids,
      SUM(b.cost_paid) as user_revenue
    FROM public.bids b
    JOIN public.profiles p ON b.user_id = p.user_id
    WHERE COALESCE(p.is_bot, false) = false
    GROUP BY b.auction_id
  ) user_stats ON a.id = user_stats.auction_id
  LEFT JOIN (
    SELECT 
      b.auction_id,
      COUNT(*) as bot_bids
    FROM public.bids b
    JOIN public.profiles p ON b.user_id = p.user_id
    WHERE p.is_bot = true
    GROUP BY b.auction_id
  ) bot_stats ON a.id = bot_stats.auction_id
  WHERE a.id = auction_uuid;
END;
$$;

-- Function to get overall financial summary
CREATE OR REPLACE FUNCTION public.get_financial_summary()
RETURNS TABLE(
  total_revenue decimal,
  auction_revenue decimal,
  package_revenue decimal,
  total_auctions integer,
  active_auctions integer,
  finished_auctions integer,
  total_users integer,
  paying_users integer,
  average_auction_revenue decimal,
  total_bids integer,
  user_bids integer,
  bot_bids integer,
  conversion_rate decimal
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (
      COALESCE((SELECT SUM(company_revenue) FROM public.auctions), 0) +
      COALESCE((SELECT SUM(amount_paid) FROM public.bid_purchases WHERE payment_status = 'completed'), 0) / 100.0
    ) as total_revenue,
    COALESCE((SELECT SUM(company_revenue) FROM public.auctions), 0) as auction_revenue,
    COALESCE((SELECT SUM(amount_paid) FROM public.bid_purchases WHERE payment_status = 'completed'), 0) / 100.0 as package_revenue,
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
$$;

-- Function to get revenue trends (last 30 days)
CREATE OR REPLACE FUNCTION public.get_revenue_trends()
RETURNS TABLE(
  date_period date,
  auction_revenue decimal,
  package_revenue decimal,
  total_revenue decimal,
  bids_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
      SUM(b.cost_paid) / 100.0 as daily_auction_revenue,
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
      SUM(bp.amount_paid) / 100.0 as daily_package_revenue
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
$$;