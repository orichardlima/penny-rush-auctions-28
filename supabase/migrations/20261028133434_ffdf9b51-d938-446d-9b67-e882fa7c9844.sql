DO $repair$
DECLARE def text; old_insert text := 'INSERT INTO public.points_redemptions(user_id, total_points, shipping_address_snapshot, idempotency_key)
  VALUES (v_user, 0, p_shipping, p_idem)';
BEGIN
 SELECT pg_get_functiondef('public.redeem_create(jsonb,jsonb,text)'::regprocedure) INTO def;
 IF position(old_insert IN def)=0 THEN RAISE EXCEPTION 'Unexpected redemption insert'; END IF;
 def := replace(def,old_insert,'IF p_items IS NULL OR jsonb_typeof(p_items) <> ''array'' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION ''invalid_items''; END IF;
  PERFORM 1 FROM public.points_store_items WHERE id IN (SELECT (x->>''item_id'')::uuid FROM jsonb_array_elements(p_items) x) ORDER BY id FOR UPDATE;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((it->>''quantity'')::int,1);
    IF v_qty <= 0 THEN RAISE EXCEPTION ''invalid_quantity''; END IF;
    SELECT * INTO v_item FROM public.points_store_items WHERE id=(it->>''item_id'')::uuid;
    IF NOT FOUND OR v_item.status <> ''ACTIVE'' THEN RAISE EXCEPTION ''item_unavailable''; END IF;
    v_total := v_total + v_item.cost_points * v_qty;
  END LOOP;
  IF v_total <= 0 THEN RAISE EXCEPTION ''invalid_total''; END IF;
  INSERT INTO public.points_redemptions(user_id, total_points, shipping_address_snapshot, idempotency_key)
  VALUES (v_user, v_total, p_shipping, p_idem)');
 def := replace(def,'RETURNING id INTO v_red_id;','RETURNING id INTO v_red_id;
  v_total := 0;');
 EXECUTE def;
END $repair$;