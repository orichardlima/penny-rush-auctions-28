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
$function$

---

-- Create function to get comprehensive user analytics
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
$function$

---

-- Create function to get hourly activity heatmap
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
$function$

---

-- Create function to get conversion funnel metrics
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
$function$

---

-- Create audit log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  old_values jsonb,
  new_values jsonb,
  description text,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admin audit log
CREATE POLICY "Admins can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() 
  AND is_admin = true
));

CREATE POLICY "Admins can insert audit logs" 
ON public.admin_audit_log 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() 
  AND is_admin = true
));

---

-- Create function to get audit logs
CREATE OR REPLACE FUNCTION public.get_admin_audit_log(limit_count integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  admin_user_id uuid,
  admin_name text,
  action_type text,
  target_type text,
  target_id uuid,
  description text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.admin_user_id,
    COALESCE(p.full_name, 'Admin ' || SUBSTRING(a.admin_user_id::text FROM 1 FOR 8)) as admin_name,
    a.action_type,
    a.target_type,
    a.target_id,
    a.description,
    a.created_at
  FROM public.admin_audit_log a
  LEFT JOIN public.profiles p ON a.admin_user_id = p.user_id
  ORDER BY a.created_at DESC
  LIMIT limit_count;
END;
$function$