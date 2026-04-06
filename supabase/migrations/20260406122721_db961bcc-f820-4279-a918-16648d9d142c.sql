-- Parte 1: Índices na tabela bids
CREATE INDEX IF NOT EXISTS idx_bids_user_id ON public.bids (user_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON public.bids (auction_id);

-- Parte 2: Reescrever get_user_analytics com CTE única
CREATE OR REPLACE FUNCTION public.get_user_analytics(user_uuid uuid)
 RETURNS TABLE(user_id uuid, full_name text, email text, is_bot boolean, total_spent numeric, total_bids integer, auctions_participated integer, auctions_won integer, avg_bid_cost numeric, first_activity timestamp with time zone, last_activity timestamp with time zone, user_classification text, favorite_time_slot text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH bid_stats AS (
    SELECT 
      COALESCE(SUM(b.cost_paid), 0) AS _total_spent,
      COUNT(*)::integer AS _total_bids,
      COUNT(DISTINCT b.auction_id)::integer AS _auctions_participated,
      COALESCE(AVG(b.cost_paid), 0) AS _avg_bid_cost,
      MIN(b.created_at) AS _first_activity,
      MAX(b.created_at) AS _last_activity
    FROM public.bids b
    WHERE b.user_id = user_uuid
  ),
  win_stats AS (
    SELECT COUNT(*)::integer AS _auctions_won
    FROM public.auctions a
    WHERE a.winner_id = user_uuid
  ),
  time_slot_stats AS (
    SELECT 
      CASE 
        WHEN EXTRACT(HOUR FROM b.created_at) BETWEEN 6 AND 11 THEN 'Manhã'
        WHEN EXTRACT(HOUR FROM b.created_at) BETWEEN 12 AND 17 THEN 'Tarde'
        WHEN EXTRACT(HOUR FROM b.created_at) BETWEEN 18 AND 23 THEN 'Noite'
        ELSE 'Madrugada'
      END AS _slot,
      COUNT(*) AS _cnt
    FROM public.bids b
    WHERE b.user_id = user_uuid
    GROUP BY _slot
    ORDER BY _cnt DESC
    LIMIT 1
  )
  SELECT 
    p.user_id,
    p.full_name,
    p.email,
    COALESCE(p.is_bot, false) AS is_bot,
    bs._total_spent,
    bs._total_bids,
    bs._auctions_participated,
    ws._auctions_won,
    bs._avg_bid_cost,
    bs._first_activity,
    bs._last_activity,
    CASE 
      WHEN bs._total_spent >= 10000 THEN 'VIP'
      WHEN bs._total_spent >= 5000 THEN 'Premium'
      WHEN EXISTS (SELECT 1 FROM public.partner_contracts pc WHERE pc.user_id = user_uuid AND pc.status = 'ACTIVE') THEN 'Parceiro'
      WHEN bs._total_bids >= 10 THEN 'Ativo'
      WHEN bs._total_bids > 0 THEN 'Casual'
      ELSE 'Inativo'
    END AS user_classification,
    COALESCE(ts._slot, 'N/A') AS favorite_time_slot
  FROM public.profiles p
  CROSS JOIN bid_stats bs
  CROSS JOIN win_stats ws
  LEFT JOIN time_slot_stats ts ON true
  WHERE p.user_id = user_uuid;
END;
$$;
