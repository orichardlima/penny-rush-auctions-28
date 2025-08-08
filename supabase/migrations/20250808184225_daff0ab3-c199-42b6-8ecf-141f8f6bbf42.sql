-- Fix the target_percentage calculation in get_auction_financials function
-- The issue is that company_revenue is in reais but revenue_target is in cents
CREATE OR REPLACE FUNCTION public.get_auction_financials(auction_uuid uuid)
 RETURNS TABLE(auction_id uuid, title text, total_bids_count integer, user_bids_count integer, bot_bids_count integer, user_bids_percentage numeric, bot_bids_percentage numeric, real_revenue numeric, revenue_target integer, target_percentage numeric, current_price integer, market_value integer, roi_percentage numeric, profit_margin numeric, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      WHEN a.revenue_target > 0 THEN ROUND((a.company_revenue / (a.revenue_target::decimal / 100.0)) * 100, 2)
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
$function$