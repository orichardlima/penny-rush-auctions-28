-- Índice composto para acelerar agregações por data com user_id
CREATE INDEX IF NOT EXISTS idx_bids_created_at_user
  ON public.bids (created_at DESC, user_id);

-- =========================================================
-- get_financial_summary_filtered
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_financial_summary_filtered(
  start_date date DEFAULT NULL::date,
  end_date date DEFAULT NULL::date,
  real_only boolean DEFAULT false
)
RETURNS TABLE(
  total_revenue numeric, auction_revenue numeric, package_revenue numeric,
  total_auctions integer, active_auctions integer, finished_auctions integer,
  total_users integer, paying_users integer, average_auction_revenue numeric,
  total_bids integer, user_bids integer, bot_bids integer, conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auction_revenue decimal := 0;
  v_package_revenue decimal := 0;
  v_total_auctions integer := 0;
  v_active_auctions integer := 0;
  v_finished_auctions integer := 0;
  v_total_users integer := 0;
  v_paying_users integer := 0;
  v_total_bids integer := 0;
  v_user_bids integer := 0;
  v_bot_bids integer := 0;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
BEGIN
  PERFORM set_config('statement_timeout', '25000', true);

  v_start_ts := COALESCE(start_date, CURRENT_DATE - INTERVAL '29 days')::timestamptz;
  v_end_ts   := (COALESCE(end_date, CURRENT_DATE) + 1)::timestamptz;

  -- Total de bids no período (usa idx_bids_created_at)
  SELECT COUNT(*)::int INTO v_total_bids
  FROM public.bids b
  WHERE b.created_at >= v_start_ts AND b.created_at < v_end_ts;

  -- Bot bids no período (subconsulta evita JOIN pesado com profiles)
  SELECT COUNT(*)::int INTO v_bot_bids
  FROM public.bids b
  WHERE b.created_at >= v_start_ts AND b.created_at < v_end_ts
    AND b.user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.is_bot = true);

  v_user_bids := GREATEST(v_total_bids - v_bot_bids, 0);

  IF real_only THEN
    -- Receita de leilão considera apenas bids pagos de usuários não-bot
    SELECT COALESCE(SUM(b.cost_paid), 0) INTO v_auction_revenue
    FROM public.bids b
    WHERE b.created_at >= v_start_ts AND b.created_at < v_end_ts
      AND b.cost_paid > 0
      AND b.user_id NOT IN (SELECT p.user_id FROM public.profiles p WHERE p.is_bot = true);
  ELSE
    SELECT COALESCE(SUM(a.company_revenue), 0) INTO v_auction_revenue
    FROM public.auctions a
    WHERE a.created_at >= v_start_ts AND a.created_at < v_end_ts;
  END IF;

  -- Receita de pacotes + usuários pagantes
  SELECT
    COALESCE(SUM(bp.amount_paid), 0),
    COUNT(DISTINCT bp.user_id)::int
  INTO v_package_revenue, v_paying_users
  FROM public.bid_purchases bp
  WHERE bp.payment_status = 'completed'
    AND bp.created_at >= v_start_ts AND bp.created_at < v_end_ts
    AND (NOT real_only OR bp.payment_id IS NOT NULL);

  -- Contagens de leilão
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE a.status = 'active')::int,
    COUNT(*) FILTER (WHERE a.status = 'finished')::int
  INTO v_total_auctions, v_active_auctions, v_finished_auctions
  FROM public.auctions a
  WHERE a.created_at >= v_start_ts AND a.created_at < v_end_ts;

  SELECT COUNT(*)::int INTO v_total_users
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
$function$;

-- =========================================================
-- get_revenue_trends_filtered
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_revenue_trends_filtered(
  start_date date DEFAULT NULL::date,
  end_date date DEFAULT NULL::date,
  real_only boolean DEFAULT false
)
RETURNS TABLE(
  date_period date, auction_revenue numeric, package_revenue numeric,
  total_revenue numeric, bids_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start date;
  v_end date;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
BEGIN
  PERFORM set_config('statement_timeout', '25000', true);

  v_start := COALESCE(start_date, CURRENT_DATE - INTERVAL '29 days');
  v_end   := COALESCE(end_date, CURRENT_DATE);
  v_start_ts := v_start::timestamptz;
  v_end_ts   := (v_end + 1)::timestamptz;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS dp
  ),
  bot_users AS (
    SELECT p.user_id FROM public.profiles p WHERE p.is_bot = true
  ),
  auction_daily AS (
    SELECT
      b.created_at::date AS bid_date,
      SUM(b.cost_paid) AS daily_auction_revenue,
      COUNT(*)::int AS daily_bids
    FROM public.bids b
    WHERE b.created_at >= v_start_ts
      AND b.created_at < v_end_ts
      AND b.user_id NOT IN (SELECT user_id FROM bot_users)
      AND (NOT real_only OR b.cost_paid > 0)
    GROUP BY b.created_at::date
  ),
  package_daily AS (
    SELECT
      bp.created_at::date AS purchase_date,
      SUM(bp.amount_paid) AS daily_package_revenue
    FROM public.bid_purchases bp
    WHERE bp.payment_status = 'completed'
      AND bp.created_at >= v_start_ts
      AND bp.created_at < v_end_ts
      AND (NOT real_only OR bp.payment_id IS NOT NULL)
    GROUP BY bp.created_at::date
  )
  SELECT
    ds.dp,
    COALESCE(ad.daily_auction_revenue, 0)::decimal,
    COALESCE(pd.daily_package_revenue, 0)::decimal,
    (COALESCE(ad.daily_auction_revenue, 0) + COALESCE(pd.daily_package_revenue, 0))::decimal,
    COALESCE(ad.daily_bids, 0)::int
  FROM date_series ds
  LEFT JOIN auction_daily ad ON ds.dp = ad.bid_date
  LEFT JOIN package_daily pd ON ds.dp = pd.purchase_date
  ORDER BY ds.dp;
END;
$function$;