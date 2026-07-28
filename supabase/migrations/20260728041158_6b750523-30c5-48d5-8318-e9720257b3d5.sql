
CREATE OR REPLACE FUNCTION public.preview_consume_bid_lots(p_user_id uuid, p_amount numeric)
 RETURNS TABLE(lot_id uuid, take numeric, eligible boolean, source text, bid_purchase_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz := public.points_get_time('points_accrual_started_at');
  v_prio jsonb := public.points_get_json('points_consumption_priority');
  v_remaining numeric := p_amount;
  r RECORD;
BEGIN
  IF (v_prio->>0) = 'eligible_paid' AND v_cutoff IS NOT NULL THEN
    FOR r IN
      SELECT bl.id AS lid, bl.remaining_amount AS rem, bl.source AS src, bl.bid_purchase_id AS bpi
      FROM public.bid_lots bl
      WHERE bl.user_id = p_user_id
        AND bl.remaining_amount > 0
        AND bl.eligible_for_points = true
        AND bl.purchased_at IS NOT NULL AND bl.purchased_at > v_cutoff
        AND (bl.expires_at IS NULL OR bl.expires_at > now())
      ORDER BY bl.purchased_at ASC, bl.id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      lot_id := r.lid;
      take := LEAST(r.rem, v_remaining);
      eligible := true;
      source := r.src;
      bid_purchase_id := r.bpi;
      v_remaining := v_remaining - take;
      RETURN NEXT;
    END LOOP;
  END IF;

  IF v_remaining > 0 THEN
    FOR r IN
      SELECT bl.id AS lid, bl.remaining_amount AS rem, bl.source AS src, bl.bid_purchase_id AS bpi
      FROM public.bid_lots bl
      WHERE bl.user_id = p_user_id
        AND bl.remaining_amount > 0
        AND (
          bl.eligible_for_points = false
          OR bl.purchased_at IS NULL
          OR v_cutoff IS NULL
          OR bl.purchased_at <= v_cutoff
        )
        AND (bl.expires_at IS NULL OR bl.expires_at > now())
      ORDER BY COALESCE(bl.purchased_at, bl.created_at) ASC, bl.id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      lot_id := r.lid;
      take := LEAST(r.rem, v_remaining);
      eligible := false;
      source := r.src;
      bid_purchase_id := r.bpi;
      v_remaining := v_remaining - take;
      RETURN NEXT;
    END LOOP;
  END IF;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'insufficient_lot_balance' USING ERRCODE = 'P0001';
  END IF;
END
$function$;
