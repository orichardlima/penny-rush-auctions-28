CREATE OR REPLACE FUNCTION public.rebuild_auction_last_bidders(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bidders jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(display_name ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_bidders
  FROM (
    SELECT 
      b.created_at,
      CASE
        WHEN p.full_name IS NULL OR btrim(p.full_name) = '' THEN 'Usuário'
        WHEN array_length(string_to_array(btrim(p.full_name), ' '), 1) >= 2
          THEN (string_to_array(btrim(p.full_name), ' '))[1] || ' ' || (string_to_array(btrim(p.full_name), ' '))[2]
        ELSE (string_to_array(btrim(p.full_name), ' '))[1]
      END AS display_name
    FROM bids b
    LEFT JOIN profiles p ON p.user_id = b.user_id
    WHERE b.auction_id = p_auction_id
    ORDER BY b.created_at DESC
    LIMIT 3
  ) sub;

  UPDATE auctions
  SET last_bidders = v_bidders
  WHERE id = p_auction_id;

  RETURN v_bidders;
END;
$$;