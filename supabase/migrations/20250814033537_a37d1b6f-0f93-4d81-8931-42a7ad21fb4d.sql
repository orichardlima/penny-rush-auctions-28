-- Create conversion funnel function
CREATE OR REPLACE FUNCTION public.get_conversion_funnel()
RETURNS TABLE(
  total_users integer,
  users_with_purchases integer,
  users_with_bids integer,
  users_with_wins integer,
  purchase_conversion_rate numeric,
  bid_conversion_rate numeric,
  win_conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.profiles WHERE COALESCE(is_bot, false) = false)::integer as total_users,
    (SELECT COUNT(DISTINCT user_id) FROM public.bid_purchases WHERE payment_status = 'completed')::integer as users_with_purchases,
    (SELECT COUNT(DISTINCT b.user_id) FROM public.bids b JOIN public.profiles p ON b.user_id = p.user_id WHERE COALESCE(p.is_bot, false) = false)::integer as users_with_bids,
    (SELECT COUNT(DISTINCT winner_id) FROM public.auctions WHERE winner_id IS NOT NULL)::integer as users_with_wins,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.profiles WHERE COALESCE(is_bot, false) = false) > 0
      THEN ROUND(
        ((SELECT COUNT(DISTINCT user_id) FROM public.bid_purchases WHERE payment_status = 'completed')::decimal / 
         (SELECT COUNT(*) FROM public.profiles WHERE COALESCE(is_bot, false) = false)::decimal) * 100, 2
      )
      ELSE 0::decimal
    END as purchase_conversion_rate,
    CASE 
      WHEN (SELECT COUNT(DISTINCT user_id) FROM public.bid_purchases WHERE payment_status = 'completed') > 0
      THEN ROUND(
        ((SELECT COUNT(DISTINCT b.user_id) FROM public.bids b JOIN public.profiles p ON b.user_id = p.user_id WHERE COALESCE(p.is_bot, false) = false)::decimal / 
         (SELECT COUNT(DISTINCT user_id) FROM public.bid_purchases WHERE payment_status = 'completed')::decimal) * 100, 2
      )
      ELSE 0::decimal
    END as bid_conversion_rate,
    CASE 
      WHEN (SELECT COUNT(DISTINCT b.user_id) FROM public.bids b JOIN public.profiles p ON b.user_id = p.user_id WHERE COALESCE(p.is_bot, false) = false) > 0
      THEN ROUND(
        ((SELECT COUNT(DISTINCT winner_id) FROM public.auctions WHERE winner_id IS NOT NULL)::decimal / 
         (SELECT COUNT(DISTINCT b.user_id) FROM public.bids b JOIN public.profiles p ON b.user_id = p.user_id WHERE COALESCE(p.is_bot, false) = false)::decimal) * 100, 2
      )
      ELSE 0::decimal
    END as win_conversion_rate;
END;
$function$;