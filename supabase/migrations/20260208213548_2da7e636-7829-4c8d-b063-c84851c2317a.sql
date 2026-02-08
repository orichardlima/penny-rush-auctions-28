
-- =====================================================
-- CORREÇÃO: Excluir lances de bot do company_revenue
-- =====================================================

-- 1. CORRIGIR TRIGGER update_auction_on_bid()
-- Alterar para somar company_revenue APENAS quando cost_paid > 0
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Format name: first name + full second name
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
  -- CORREÇÃO: company_revenue só incrementa quando cost_paid > 0 (lance real pago)
  UPDATE public.auctions 
  SET 
    current_price = COALESCE(current_price, COALESCE(starting_price, 0)) + v_bid_increment,
    total_bids = COALESCE(total_bids, 0) + 1,
    company_revenue = COALESCE(company_revenue, 0) + CASE WHEN NEW.cost_paid > 0 THEN v_bid_cost ELSE 0 END,
    time_left = 15,
    last_bid_at = NOW(),
    last_bidders = v_current_bidders,
    updated_at = NOW()
  WHERE id = NEW.auction_id;
  
  RETURN NEW;
END;
$function$;

-- 2. CORRIGIR BIDS LEGADOS DE BOTS com cost_paid > 0
UPDATE public.bids b
SET cost_paid = 0
FROM public.profiles p
WHERE b.user_id = p.user_id
  AND p.is_bot = true
  AND b.cost_paid > 0;

-- 3. RECALCULAR company_revenue DE TODOS OS LEILÕES
-- Primeiro: leilões que tiveram bids pagos
UPDATE public.auctions a
SET company_revenue = COALESCE(sub.real_revenue, 0)
FROM (
  SELECT auction_id, SUM(cost_paid) as real_revenue
  FROM public.bids
  WHERE cost_paid > 0
  GROUP BY auction_id
) sub
WHERE a.id = sub.auction_id;

-- Segundo: zerar leilões sem nenhum bid pago
UPDATE public.auctions
SET company_revenue = 0
WHERE id NOT IN (
  SELECT DISTINCT auction_id FROM public.bids WHERE cost_paid > 0
);

-- 4. ATUALIZAR FUNÇÃO get_auction_financials()
-- Usar SUM(cost_paid) direto dos bids reais em vez de company_revenue
CREATE OR REPLACE FUNCTION public.get_auction_financials(auction_uuid uuid)
 RETURNS TABLE(auction_id uuid, title text, total_bids_count integer, user_bids_count integer, bot_bids_count integer, user_bids_percentage numeric, bot_bids_percentage numeric, real_revenue numeric, revenue_target numeric, target_percentage numeric, current_price numeric, market_value numeric, roi_percentage numeric, profit_margin numeric, status text)
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
    COALESCE(user_stats.user_revenue, 0) as real_revenue,
    a.revenue_target,
    CASE 
      WHEN a.revenue_target > 0 THEN ROUND((COALESCE(user_stats.user_revenue, 0) / a.revenue_target::decimal) * 100, 2)
      ELSE 0::decimal
    END as target_percentage,
    a.current_price,
    a.market_value,
    CASE 
      WHEN a.market_value > 0 THEN ROUND((COALESCE(user_stats.user_revenue, 0) / a.market_value::decimal) * 100, 2)
      ELSE 0::decimal
    END as roi_percentage,
    (COALESCE(user_stats.user_revenue, 0) - a.market_value::decimal) as profit_margin,
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
$function$;
