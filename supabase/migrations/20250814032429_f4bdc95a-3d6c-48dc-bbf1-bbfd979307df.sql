-- Create hourly activity function
CREATE OR REPLACE FUNCTION public.get_hourly_activity()
RETURNS TABLE(
  hour_of_day integer,
  day_of_week integer,
  bid_count integer,
  user_count integer,
  revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM b.created_at)::integer as hour_of_day,
    EXTRACT(DOW FROM b.created_at)::integer as day_of_week,
    COUNT(b.id)::integer as bid_count,
    COUNT(DISTINCT b.user_id)::integer as user_count,
    (SUM(b.cost_paid) / 100.0) as revenue
  FROM public.bids b
  JOIN public.profiles p ON b.user_id = p.user_id
  WHERE COALESCE(p.is_bot, false) = false
    AND b.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY hour_of_day, day_of_week
  ORDER BY hour_of_day, day_of_week;
END;
$function$;