
-- =============================================
-- Fix: usar segundo nome completo (sem abreviar)
-- =============================================

CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_auction RECORD;
  v_bid_increment NUMERIC;
  v_bid_cost NUMERIC;
  v_full_name TEXT;
  v_display_name TEXT;
  v_name_parts TEXT[];
  v_current_bidders JSONB;
BEGIN
  -- Get auction data
  SELECT * INTO v_auction FROM public.auctions WHERE id = NEW.auction_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Only process for active auctions
  IF v_auction.status != 'active' THEN
    RETURN NEW;
  END IF;
  
  v_bid_increment := COALESCE(v_auction.bid_increment, 0.01);
  v_bid_cost := COALESCE(v_auction.bid_cost, 1.50);
  
  -- Get user display name
  SELECT full_name INTO v_full_name 
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  -- Format name: first name + full second name (matching frontend formatUserNameForDisplay)
  IF v_full_name IS NOT NULL AND v_full_name != '' AND v_full_name != 'Usuário' THEN
    v_name_parts := string_to_array(trim(v_full_name), ' ');
    IF array_length(v_name_parts, 1) >= 2 THEN
      v_display_name := v_name_parts[1] || ' ' || v_name_parts[2];
    ELSIF array_length(v_name_parts, 1) = 1 THEN
      v_display_name := v_name_parts[1];
    ELSE
      v_display_name := 'Usuário';
    END IF;
  ELSE
    v_display_name := 'Usuário';
  END IF;
  
  -- Get current bidders array
  v_current_bidders := COALESCE(v_auction.last_bidders, '[]'::jsonb);
  
  -- Prepend new bidder and keep max 3
  v_current_bidders := (to_jsonb(v_display_name) || v_current_bidders);
  IF jsonb_array_length(v_current_bidders) > 3 THEN
    v_current_bidders := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord
        LIMIT 3
      ) sub
    );
  END IF;
  
  -- Update auction
  UPDATE public.auctions 
  SET 
    current_price = COALESCE(current_price, COALESCE(starting_price, 0)) + v_bid_increment,
    total_bids = COALESCE(total_bids, 0) + 1,
    company_revenue = COALESCE(company_revenue, 0) + v_bid_cost,
    time_left = 15,
    last_bid_at = NOW(),
    last_bidders = v_current_bidders,
    updated_at = NOW()
  WHERE id = NEW.auction_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- Re-backfill: corrigir nomes já salvos
-- =============================================
UPDATE public.auctions a
SET last_bidders = sub.bidders
FROM (
  SELECT 
    b.auction_id,
    jsonb_agg(
      CASE 
        WHEN p.full_name IS NOT NULL 
             AND p.full_name != '' 
             AND p.full_name != 'Usuário'
             AND array_length(string_to_array(trim(p.full_name), ' '), 1) >= 2
        THEN to_jsonb(
          (string_to_array(trim(p.full_name), ' '))[1] || ' ' || 
          (string_to_array(trim(p.full_name), ' '))[2]
        )
        WHEN p.full_name IS NOT NULL 
             AND p.full_name != '' 
             AND p.full_name != 'Usuário'
             AND array_length(string_to_array(trim(p.full_name), ' '), 1) = 1
        THEN to_jsonb((string_to_array(trim(p.full_name), ' '))[1])
        ELSE to_jsonb('Usuário'::text)
      END
    ) AS bidders
  FROM (
    SELECT DISTINCT ON (auction_id, user_id) auction_id, user_id, created_at
    FROM public.bids
    WHERE auction_id IN (SELECT id FROM public.auctions WHERE status IN ('active', 'waiting'))
    ORDER BY auction_id, user_id, created_at DESC
  ) unique_bids
  INNER JOIN (
    SELECT auction_id, user_id, created_at
    FROM public.bids
    WHERE auction_id IN (SELECT id FROM public.auctions WHERE status IN ('active', 'waiting'))
    ORDER BY created_at DESC
  ) b ON b.auction_id = unique_bids.auction_id AND b.user_id = unique_bids.user_id AND b.created_at = unique_bids.created_at
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  GROUP BY b.auction_id
) sub
WHERE a.id = sub.auction_id
AND a.status IN ('active', 'waiting');
