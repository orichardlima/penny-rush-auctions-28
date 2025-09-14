-- Create filtered financial summary function
CREATE OR REPLACE FUNCTION public.get_financial_summary_filtered(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  real_only boolean DEFAULT false
)
RETURNS TABLE(
  total_revenue numeric,
  auction_revenue numeric, 
  package_revenue numeric,
  total_auctions integer,
  active_auctions integer,
  finished_auctions integer,
  total_users integer,
  paying_users integer,
  average_auction_revenue numeric,
  total_bids integer,
  user_bids integer,
  bot_bids integer,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (
      COALESCE((
        SELECT SUM(a.company_revenue) 
        FROM public.auctions a
        WHERE (start_date IS NULL OR DATE(a.created_at) >= start_date)
          AND (end_date IS NULL OR DATE(a.created_at) <= end_date)
      ), 0) +
      COALESCE((
        SELECT SUM(bp.amount_paid) 
        FROM public.bid_purchases bp
        WHERE bp.payment_status = 'completed'
          AND (start_date IS NULL OR DATE(bp.created_at) >= start_date)
          AND (end_date IS NULL OR DATE(bp.created_at) <= end_date)
          AND (NOT real_only OR bp.payment_id IS NOT NULL)
      ), 0)
    ) as total_revenue,
    
    COALESCE((
      SELECT SUM(a.company_revenue) 
      FROM public.auctions a
      WHERE (start_date IS NULL OR DATE(a.created_at) >= start_date)
        AND (end_date IS NULL OR DATE(a.created_at) <= end_date)
    ), 0) as auction_revenue,
    
    COALESCE((
      SELECT SUM(bp.amount_paid) 
      FROM public.bid_purchases bp
      WHERE bp.payment_status = 'completed'
        AND (start_date IS NULL OR DATE(bp.created_at) >= start_date)
        AND (end_date IS NULL OR DATE(bp.created_at) <= end_date)
        AND (NOT real_only OR bp.payment_id IS NOT NULL)
    ), 0) as package_revenue,
    
    (
      SELECT COUNT(*) 
      FROM public.auctions a
      WHERE (start_date IS NULL OR DATE(a.created_at) >= start_date)
        AND (end_date IS NULL OR DATE(a.created_at) <= end_date)
    )::integer as total_auctions,
    
    (
      SELECT COUNT(*) 
      FROM public.auctions a
      WHERE a.status = 'active'
        AND (start_date IS NULL OR DATE(a.created_at) >= start_date)
        AND (end_date IS NULL OR DATE(a.created_at) <= end_date)
    )::integer as active_auctions,
    
    (
      SELECT COUNT(*) 
      FROM public.auctions a
      WHERE a.status = 'finished'
        AND (start_date IS NULL OR DATE(a.created_at) >= start_date)
        AND (end_date IS NULL OR DATE(a.created_at) <= end_date)
    )::integer as finished_auctions,
    
    (SELECT COUNT(*) FROM public.profiles WHERE is_bot = false)::integer as total_users,
    
    (
      SELECT COUNT(DISTINCT bp.user_id) 
      FROM public.bid_purchases bp
      WHERE bp.payment_status = 'completed'
        AND (start_date IS NULL OR DATE(bp.created_at) >= start_date)
        AND (end_date IS NULL OR DATE(bp.created_at) <= end_date)
        AND (NOT real_only OR bp.payment_id IS NOT NULL)
    )::integer as paying_users,
    
    CASE 
      WHEN (
        SELECT COUNT(*) 
        FROM public.auctions a
        WHERE a.status = 'finished'
          AND (start_date IS NULL OR DATE(a.created_at) >= start_date)
          AND (end_date IS NULL OR DATE(a.created_at) <= end_date)
      ) > 0 
      THEN (
        SELECT AVG(a.company_revenue) 
        FROM public.auctions a
        WHERE a.status = 'finished'
          AND (start_date IS NULL OR DATE(a.created_at) >= start_date)
          AND (end_date IS NULL OR DATE(a.created_at) <= end_date)
      )
      ELSE 0::decimal
    END as average_auction_revenue,
    
    (
      SELECT COUNT(*) 
      FROM public.bids b
      JOIN public.auctions a ON b.auction_id = a.id
      WHERE (start_date IS NULL OR DATE(b.created_at) >= start_date)
        AND (end_date IS NULL OR DATE(b.created_at) <= end_date)
    )::integer as total_bids,
    
    (
      SELECT COUNT(*) 
      FROM public.bids b 
      JOIN public.profiles p ON b.user_id = p.user_id 
      JOIN public.auctions a ON b.auction_id = a.id
      WHERE COALESCE(p.is_bot, false) = false
        AND (start_date IS NULL OR DATE(b.created_at) >= start_date)
        AND (end_date IS NULL OR DATE(b.created_at) <= end_date)
        AND (NOT real_only OR b.cost_paid > 0)
    )::integer as user_bids,
    
    (
      SELECT COUNT(*) 
      FROM public.bids b 
      JOIN public.profiles p ON b.user_id = p.user_id 
      JOIN public.auctions a ON b.auction_id = a.id
      WHERE p.is_bot = true
        AND (start_date IS NULL OR DATE(b.created_at) >= start_date)
        AND (end_date IS NULL OR DATE(b.created_at) <= end_date)
    )::integer as bot_bids,
    
    CASE 
      WHEN (SELECT COUNT(*) FROM public.profiles WHERE is_bot = false) > 0
      THEN ROUND(
        ((
          SELECT COUNT(DISTINCT bp.user_id) 
          FROM public.bid_purchases bp
          WHERE bp.payment_status = 'completed'
            AND (start_date IS NULL OR DATE(bp.created_at) >= start_date)
            AND (end_date IS NULL OR DATE(bp.created_at) <= end_date)
            AND (NOT real_only OR bp.payment_id IS NOT NULL)
        )::decimal / 
        (SELECT COUNT(*) FROM public.profiles WHERE is_bot = false)::decimal) * 100, 2
      )
      ELSE 0::decimal
    END as conversion_rate;
END;
$function$;

-- Create filtered revenue trends function  
CREATE OR REPLACE FUNCTION public.get_revenue_trends_filtered(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  real_only boolean DEFAULT false
)
RETURNS TABLE(
  date_period date,
  auction_revenue numeric,
  package_revenue numeric, 
  total_revenue numeric,
  bids_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  filter_start_date date;
  filter_end_date date;
BEGIN
  -- Default to last 30 days if no dates provided
  filter_start_date := COALESCE(start_date, CURRENT_DATE - INTERVAL '29 days');
  filter_end_date := COALESCE(end_date, CURRENT_DATE);
  
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      filter_start_date,
      filter_end_date,
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
      AND DATE(b.created_at) BETWEEN filter_start_date AND filter_end_date
      AND (NOT real_only OR b.cost_paid > 0)
    GROUP BY DATE(b.created_at)
  ),
  package_daily AS (
    SELECT 
      DATE(bp.created_at) as purchase_date,
      SUM(bp.amount_paid) as daily_package_revenue
    FROM public.bid_purchases bp
    WHERE bp.payment_status = 'completed'
      AND DATE(bp.created_at) BETWEEN filter_start_date AND filter_end_date
      AND (NOT real_only OR bp.payment_id IS NOT NULL)
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