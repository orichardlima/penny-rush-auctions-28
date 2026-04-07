-- Parte 1: Índices adicionais
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON public.bids (created_at);
CREATE INDEX IF NOT EXISTS idx_bid_purchases_payment_status ON public.bid_purchases (payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_bid_purchases_user_id ON public.bid_purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_bot ON public.profiles (is_bot);

-- Parte 2: Reescrever get_financial_summary_filtered com CTEs
CREATE OR REPLACE FUNCTION public.get_financial_summary_filtered(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  real_only boolean DEFAULT false
)
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
SET search_path TO 'public'
AS $$
DECLARE
  v_auction_revenue decimal;
  v_package_revenue decimal;
  v_total_auctions integer;
  v_active_auctions integer;
  v_finished_auctions integer;
  v_total_users integer;
  v_paying_users integer;
  v_total_bids integer;
  v_user_bids integer;
  v_bot_bids integer;
BEGIN
  -- Bid aggregates in one pass using the new indexes
  IF real_only THEN
    SELECT 
      COALESCE(SUM(b.cost_paid) FILTER (WHERE NOT COALESCE(p.is_bot, false) AND b.cost_paid > 0), 0),
      COUNT(*)::integer,
      COUNT(*) FILTER (WHERE NOT COALESCE(p.is_bot, false))::integer,
      COUNT(*) FILTER (WHERE COALESCE(p.is_bot, false) = true)::integer
    INTO v_auction_revenue, v_total_bids, v_user_bids, v_bot_bids
    FROM public.bids b
    JOIN public.profiles p ON p.user_id = b.user_id
    WHERE (start_date IS NULL OR b.created_at >= start_date::timestamp)
      AND (end_date IS NULL OR b.created_at < (end_date + 1)::timestamp);
  ELSE
    -- Auction revenue from auctions table
    SELECT COALESCE(SUM(a.company_revenue), 0)
    INTO v_auction_revenue
    FROM public.auctions a
    WHERE (start_date IS NULL OR a.created_at >= start_date::timestamp)
      AND (end_date IS NULL OR a.created_at < (end_date + 1)::timestamp);

    -- Bid counts in one pass
    SELECT 
      COUNT(*)::integer,
      COUNT(*) FILTER (WHERE NOT COALESCE(p.is_bot, false))::integer,
      COUNT(*) FILTER (WHERE COALESCE(p.is_bot, false) = true)::integer
    INTO v_total_bids, v_user_bids, v_bot_bids
    FROM public.bids b
    JOIN public.profiles p ON p.user_id = b.user_id
    WHERE (start_date IS NULL OR b.created_at >= start_date::timestamp)
      AND (end_date IS NULL OR b.created_at < (end_date + 1)::timestamp);
  END IF;

  -- Package revenue + paying users in one pass
  SELECT 
    COALESCE(SUM(bp.amount_paid), 0),
    COUNT(DISTINCT bp.user_id)::integer
  INTO v_package_revenue, v_paying_users
  FROM public.bid_purchases bp
  WHERE bp.payment_status = 'completed'
    AND (start_date IS NULL OR bp.created_at >= start_date::timestamp)
    AND (end_date IS NULL OR bp.created_at < (end_date + 1)::timestamp)
    AND (NOT real_only OR bp.payment_id IS NOT NULL);

  -- Auction counts in one pass
  SELECT 
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE a.status = 'active')::integer,
    COUNT(*) FILTER (WHERE a.status = 'finished')::integer
  INTO v_total_auctions, v_active_auctions, v_finished_auctions
  FROM public.auctions a
  WHERE (start_date IS NULL OR a.created_at >= start_date::timestamp)
    AND (end_date IS NULL OR a.created_at < (end_date + 1)::timestamp);

  -- Total non-bot users (no date filter)
  SELECT COUNT(*)::integer INTO v_total_users
  FROM public.profiles WHERE COALESCE(is_bot, false) = false;

  RETURN QUERY SELECT
    (v_auction_revenue + v_package_revenue),
    v_auction_revenue,
    v_package_revenue,
    v_total_auctions,
    v_active_auctions,
    v_finished_auctions,
    v_total_users,
    v_paying_users,
    CASE WHEN v_finished_auctions > 0 
      THEN v_auction_revenue / v_finished_auctions 
      ELSE 0::decimal END,
    v_total_bids,
    v_user_bids,
    v_bot_bids,
    CASE WHEN v_total_users > 0 
      THEN ROUND((v_paying_users::decimal / v_total_users::decimal) * 100, 2)
      ELSE 0::decimal END;
END;
$$;

-- Parte 3: Reescrever get_revenue_trends_filtered com range filter
CREATE OR REPLACE FUNCTION public.get_revenue_trends_filtered(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  real_only boolean DEFAULT false
)
RETURNS TABLE(
  date_period date,
  auction_revenue decimal,
  package_revenue decimal,
  total_revenue decimal,
  bids_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  filter_start_date date;
  filter_end_date date;
BEGIN
  filter_start_date := COALESCE(start_date, CURRENT_DATE - INTERVAL '29 days');
  filter_end_date := COALESCE(end_date, CURRENT_DATE);
  
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      filter_start_date,
      filter_end_date,
      '1 day'::interval
    )::date AS dp
  ),
  auction_daily AS (
    SELECT 
      b.created_at::date as bid_date,
      SUM(b.cost_paid) as daily_auction_revenue,
      COUNT(*)::integer as daily_bids
    FROM public.bids b
    JOIN public.profiles p ON b.user_id = p.user_id
    WHERE COALESCE(p.is_bot, false) = false
      AND b.created_at >= filter_start_date::timestamp
      AND b.created_at < (filter_end_date + 1)::timestamp
      AND (NOT real_only OR b.cost_paid > 0)
    GROUP BY b.created_at::date
  ),
  package_daily AS (
    SELECT 
      bp.created_at::date as purchase_date,
      SUM(bp.amount_paid) as daily_package_revenue
    FROM public.bid_purchases bp
    WHERE bp.payment_status = 'completed'
      AND bp.created_at >= filter_start_date::timestamp
      AND bp.created_at < (filter_end_date + 1)::timestamp
      AND (NOT real_only OR bp.payment_id IS NOT NULL)
    GROUP BY bp.created_at::date
  )
  SELECT 
    ds.dp,
    COALESCE(ad.daily_auction_revenue, 0)::decimal,
    COALESCE(pd.daily_package_revenue, 0)::decimal,
    (COALESCE(ad.daily_auction_revenue, 0) + COALESCE(pd.daily_package_revenue, 0))::decimal,
    COALESCE(ad.daily_bids, 0)::integer
  FROM date_series ds
  LEFT JOIN auction_daily ad ON ds.dp = ad.bid_date
  LEFT JOIN package_daily pd ON ds.dp = pd.purchase_date
  ORDER BY ds.dp;
END;
$$;