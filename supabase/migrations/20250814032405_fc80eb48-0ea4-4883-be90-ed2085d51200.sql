-- Create remaining functions
CREATE OR REPLACE FUNCTION public.get_user_analytics(user_uuid uuid)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  is_bot boolean,
  total_spent numeric,
  total_bids integer,
  auctions_participated integer,
  auctions_won integer,
  avg_bid_cost numeric,
  first_activity timestamp with time zone,
  last_activity timestamp with time zone,
  user_classification text,
  favorite_time_slot text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    p.email,
    COALESCE(p.is_bot, false) as is_bot,
    COALESCE((SELECT SUM(cost_paid) / 100.0 FROM public.bids WHERE user_id = user_uuid), 0) as total_spent,
    COALESCE((SELECT COUNT(*) FROM public.bids WHERE user_id = user_uuid), 0)::integer as total_bids,
    COALESCE((SELECT COUNT(DISTINCT auction_id) FROM public.bids WHERE user_id = user_uuid), 0)::integer as auctions_participated,
    COALESCE((SELECT COUNT(*) FROM public.auctions WHERE winner_id = user_uuid), 0)::integer as auctions_won,
    COALESCE((SELECT AVG(cost_paid) / 100.0 FROM public.bids WHERE user_id = user_uuid), 0) as avg_bid_cost,
    (SELECT MIN(created_at) FROM public.bids WHERE user_id = user_uuid) as first_activity,
    (SELECT MAX(created_at) FROM public.bids WHERE user_id = user_uuid) as last_activity,
    CASE 
      WHEN COALESCE((SELECT SUM(cost_paid) FROM public.bids WHERE user_id = user_uuid), 0) >= 10000 THEN 'VIP'
      WHEN COALESCE((SELECT SUM(cost_paid) FROM public.bids WHERE user_id = user_uuid), 0) >= 5000 THEN 'Premium'
      WHEN COALESCE((SELECT COUNT(*) FROM public.bids WHERE user_id = user_uuid), 0) >= 10 THEN 'Ativo'
      WHEN COALESCE((SELECT COUNT(*) FROM public.bids WHERE user_id = user_uuid), 0) > 0 THEN 'Casual'
      ELSE 'Inativo'
    END as user_classification,
    COALESCE((
      SELECT 
        CASE 
          WHEN EXTRACT(HOUR FROM created_at) BETWEEN 6 AND 12 THEN 'Manhã'
          WHEN EXTRACT(HOUR FROM created_at) BETWEEN 12 AND 18 THEN 'Tarde'
          WHEN EXTRACT(HOUR FROM created_at) BETWEEN 18 AND 24 THEN 'Noite'
          ELSE 'Madrugada'
        END as time_slot
      FROM public.bids 
      WHERE user_id = user_uuid 
      GROUP BY time_slot
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ), 'N/A') as favorite_time_slot
  FROM public.profiles p
  WHERE p.user_id = user_uuid;
END;
$function$;