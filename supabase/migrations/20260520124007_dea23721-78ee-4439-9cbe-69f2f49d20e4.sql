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

  -- Única passada com LEFT JOIN (hash) em bots — evita subselect por linha
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE bp.user_id IS NOT NULL)::int,
    COALESCE(SUM(b.cost_paid) FILTER (WHERE bp.user_id IS NULL AND b.cost_paid > 0), 0)
  INTO v_total_bids, v_bot_bids, v_auction_revenue
  FROM public.bids b
  LEFT JOIN (SELECT user_id FROM public.profiles WHERE is_bot = true) bp
    ON bp.user_id = b.user_id
  WHERE b.created_at >= v_start_ts AND b.created_at < v_end_ts;

  v_user_bids := GREATEST(v_total_bids - v_bot_bids, 0);

  IF NOT real_only THEN
    SELECT COALESCE(SUM(a.company_revenue), 0) INTO v_auction_revenue
    FROM public.auctions a
    WHERE a.created_at >= v_start_ts AND a.created_at < v_end_ts;
  END IF;

  SELECT
    COALESCE(SUM(bp.amount_paid), 0),
    COUNT(DISTINCT bp.user_id)::int
  INTO v_package_revenue, v_paying_users
  FROM public.bid_purchases bp
  WHERE bp.payment_status = 'completed'
    AND bp.created_at >= v_start_ts AND bp.created_at < v_end_ts
    AND (NOT real_only OR bp.payment_id IS NOT NULL);

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