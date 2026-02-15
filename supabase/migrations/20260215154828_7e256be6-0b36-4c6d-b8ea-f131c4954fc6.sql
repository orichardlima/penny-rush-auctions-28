
-- ETAPA 1a: Corrigir cost_paid dos bots para 0
UPDATE public.bids SET cost_paid = 0
WHERE user_id IN (SELECT user_id FROM public.profiles WHERE is_bot = true)
AND cost_paid > 0;

-- ETAPA 1b: Recalcular company_revenue de todos os leilões baseado apenas em lances reais
UPDATE public.auctions a SET company_revenue = COALESCE(
  (SELECT SUM(b.cost_paid)
   FROM public.bids b
   JOIN public.profiles p ON p.user_id = b.user_id
   WHERE b.auction_id = a.id
   AND p.is_bot = false
   AND b.cost_paid > 0), 0
);

-- ETAPA 2: Corrigir o Trigger para verificar is_bot antes de incrementar company_revenue
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_bid_increment NUMERIC;
  v_bid_cost NUMERIC;
  v_full_name TEXT;
  v_display_name TEXT;
  v_name_parts TEXT[];
  v_current_bidders JSONB;
  v_is_bot BOOLEAN;
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
  
  -- Check if user is bot
  SELECT COALESCE(is_bot, false) INTO v_is_bot
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
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
  -- CORREÇÃO: company_revenue só incrementa para usuários REAIS com cost_paid > 0
  UPDATE public.auctions 
  SET 
    current_price = COALESCE(current_price, COALESCE(starting_price, 0)) + v_bid_increment,
    total_bids = COALESCE(total_bids, 0) + 1,
    company_revenue = COALESCE(company_revenue, 0) + 
      CASE WHEN NEW.cost_paid > 0 AND NOT v_is_bot THEN v_bid_cost ELSE 0 END,
    time_left = 15,
    last_bid_at = NOW(),
    last_bidders = v_current_bidders,
    updated_at = NOW()
  WHERE id = NEW.auction_id;
  
  RETURN NEW;
END;
$$;

-- ETAPA 3: Atualizar RPC get_financial_summary_filtered para filtrar bots quando real_only=true
CREATE OR REPLACE FUNCTION public.get_financial_summary_filtered(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  real_only boolean DEFAULT false
)
RETURNS TABLE(
  total_revenue decimal,
  auction_revenue decimal,
  package_revenue decimal,
  total_auctions integer,
  active_auctions integer,
  finished_auctions integer,
  total_users integer,
  paying_users integer,
  average_auction_revenue decimal,
  total_bids integer,
  user_bids integer,
  bot_bids integer,
  conversion_rate decimal
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction_revenue decimal;
  v_package_revenue decimal;
  v_finished_count integer;
BEGIN
  -- Auction revenue: quando real_only=true, calcula direto dos bids filtrando bots
  IF real_only THEN
    SELECT COALESCE(SUM(b.cost_paid), 0) INTO v_auction_revenue
    FROM public.bids b
    JOIN public.profiles p ON p.user_id = b.user_id
    WHERE p.is_bot = false
      AND b.cost_paid > 0
      AND (start_date IS NULL OR DATE(b.created_at) >= start_date)
      AND (end_date IS NULL OR DATE(b.created_at) <= end_date);
  ELSE
    SELECT COALESCE(SUM(a.company_revenue), 0) INTO v_auction_revenue
    FROM public.auctions a
    WHERE (start_date IS NULL OR DATE(a.created_at) >= start_date)
      AND (end_date IS NULL OR DATE(a.created_at) <= end_date);
  END IF;

  -- Package revenue
  SELECT COALESCE(SUM(bp.amount_paid), 0) INTO v_package_revenue
  FROM public.bid_purchases bp
  WHERE bp.payment_status = 'completed'
    AND (start_date IS NULL OR DATE(bp.created_at) >= start_date)
    AND (end_date IS NULL OR DATE(bp.created_at) <= end_date)
    AND (NOT real_only OR bp.payment_id IS NOT NULL);

  -- Finished auctions count
  SELECT COUNT(*)::integer INTO v_finished_count
  FROM public.auctions a
  WHERE a.status = 'finished'
    AND (start_date IS NULL OR DATE(a.created_at) >= start_date)
    AND (end_date IS NULL OR DATE(a.created_at) <= end_date);

  RETURN QUERY
  SELECT 
    (v_auction_revenue + v_package_revenue) as total_revenue,
    v_auction_revenue as auction_revenue,
    v_package_revenue as package_revenue,
    
    (SELECT COUNT(*) FROM public.auctions a
     WHERE (start_date IS NULL OR DATE(a.created_at) >= start_date)
       AND (end_date IS NULL OR DATE(a.created_at) <= end_date))::integer as total_auctions,
    
    (SELECT COUNT(*) FROM public.auctions a
     WHERE a.status = 'active'
       AND (start_date IS NULL OR DATE(a.created_at) >= start_date)
       AND (end_date IS NULL OR DATE(a.created_at) <= end_date))::integer as active_auctions,
    
    v_finished_count as finished_auctions,
    
    (SELECT COUNT(*) FROM public.profiles WHERE is_bot = false)::integer as total_users,
    
    (SELECT COUNT(DISTINCT bp2.user_id) FROM public.bid_purchases bp2
     WHERE bp2.payment_status = 'completed'
       AND (start_date IS NULL OR DATE(bp2.created_at) >= start_date)
       AND (end_date IS NULL OR DATE(bp2.created_at) <= end_date)
       AND (NOT real_only OR bp2.payment_id IS NOT NULL))::integer as paying_users,
    
    CASE WHEN v_finished_count > 0 THEN
      CASE WHEN real_only THEN
        (SELECT COALESCE(SUM(b2.cost_paid), 0) / v_finished_count
         FROM public.bids b2
         JOIN public.profiles p2 ON p2.user_id = b2.user_id
         JOIN public.auctions a2 ON a2.id = b2.auction_id
         WHERE p2.is_bot = false AND b2.cost_paid > 0
           AND a2.status = 'finished'
           AND (start_date IS NULL OR DATE(b2.created_at) >= start_date)
           AND (end_date IS NULL OR DATE(b2.created_at) <= end_date))
      ELSE
        (SELECT AVG(a2.company_revenue) FROM public.auctions a2
         WHERE a2.status = 'finished'
           AND (start_date IS NULL OR DATE(a2.created_at) >= start_date)
           AND (end_date IS NULL OR DATE(a2.created_at) <= end_date))
      END
    ELSE 0::decimal END as average_auction_revenue,
    
    (SELECT COUNT(*) FROM public.bids b3
     JOIN public.auctions a3 ON b3.auction_id = a3.id
     WHERE (start_date IS NULL OR DATE(b3.created_at) >= start_date)
       AND (end_date IS NULL OR DATE(b3.created_at) <= end_date))::integer as total_bids,
    
    (SELECT COUNT(*) FROM public.bids b4
     JOIN public.profiles p4 ON b4.user_id = p4.user_id
     WHERE COALESCE(p4.is_bot, false) = false
       AND (start_date IS NULL OR DATE(b4.created_at) >= start_date)
       AND (end_date IS NULL OR DATE(b4.created_at) <= end_date)
       AND (NOT real_only OR b4.cost_paid > 0))::integer as user_bids,
    
    (SELECT COUNT(*) FROM public.bids b5
     JOIN public.profiles p5 ON b5.user_id = p5.user_id
     WHERE p5.is_bot = true
       AND (start_date IS NULL OR DATE(b5.created_at) >= start_date)
       AND (end_date IS NULL OR DATE(b5.created_at) <= end_date))::integer as bot_bids,
    
    CASE WHEN (SELECT COUNT(*) FROM public.profiles WHERE is_bot = false) > 0
    THEN ROUND(
      ((SELECT COUNT(DISTINCT bp3.user_id) FROM public.bid_purchases bp3
        WHERE bp3.payment_status = 'completed'
          AND (start_date IS NULL OR DATE(bp3.created_at) >= start_date)
          AND (end_date IS NULL OR DATE(bp3.created_at) <= end_date)
          AND (NOT real_only OR bp3.payment_id IS NOT NULL))::decimal /
       (SELECT COUNT(*) FROM public.profiles WHERE is_bot = false)::decimal) * 100, 2)
    ELSE 0::decimal END as conversion_rate;
END;
$$;
