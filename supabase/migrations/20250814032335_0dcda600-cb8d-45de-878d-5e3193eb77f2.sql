-- Create function to get detailed auction participants
CREATE OR REPLACE FUNCTION public.get_auction_participants(auction_uuid uuid)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  is_bot boolean,
  total_spent numeric,
  bid_count integer,
  first_bid_at timestamp with time zone,
  last_bid_at timestamp with time zone,
  avg_time_between_bids interval
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    COALESCE(p.full_name, 'Usuário ' || SUBSTRING(p.user_id::text FROM 1 FOR 8)) as user_name,
    COALESCE(p.is_bot, false) as is_bot,
    (SUM(b.cost_paid) / 100.0) as total_spent,
    COUNT(b.id)::integer as bid_count,
    MIN(b.created_at) as first_bid_at,
    MAX(b.created_at) as last_bid_at,
    CASE 
      WHEN COUNT(b.id) > 1 
      THEN (MAX(b.created_at) - MIN(b.created_at)) / (COUNT(b.id) - 1)
      ELSE INTERVAL '0'
    END as avg_time_between_bids
  FROM public.bids b
  JOIN public.profiles p ON b.user_id = p.user_id
  WHERE b.auction_id = auction_uuid
  GROUP BY p.user_id, p.full_name, p.is_bot
  ORDER BY total_spent DESC, bid_count DESC;
END;
$function$;