-- =====================================================================
-- Fase 2B — Loja e Resgates (branch-only). Depende da Fase 2A.
-- =====================================================================
BEGIN;

-- Enums --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.points_store_item_status AS ENUM
    ('DRAFT','ACTIVE','PAUSED','OUT_OF_STOCK','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.points_store_item_type AS ENUM ('PHYSICAL','DIGITAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.points_inventory_movement_type AS ENUM
    ('ENTRY','RESERVE','RELEASE','REDEMPTION','ADJUSTMENT','LOSS','DAMAGE','RETURN','CANCELLATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.points_redemption_status AS ENUM
    ('PENDING','APPROVED','REJECTED','SEPARATING','SHIPPED','DELIVERED','CANCELLED','REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Categorias ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_store_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_store_categories TO anon, authenticated;
GRANT ALL    ON public.points_store_categories TO service_role;
ALTER TABLE public.points_store_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cats_read_all"  ON public.points_store_categories FOR SELECT USING (true);
CREATE POLICY "cats_admin_all" ON public.points_store_categories FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

-- Items --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  full_description  text,
  category_id uuid REFERENCES public.points_store_categories(id),
  brand text, model text, sku text UNIQUE,
  main_image_url text,
  cost_points bigint NOT NULL CHECK (cost_points > 0),
  internal_cost_brl numeric(12,2),
  reference_value_brl numeric(12,2),
  stock_total     integer NOT NULL DEFAULT 0 CHECK (stock_total >= 0),
  stock_reserved  integer NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  stock_available integer GENERATED ALWAYS AS (stock_total - stock_reserved) STORED,
  stock_min       integer NOT NULL DEFAULT 0,
  per_user_limit  integer,
  item_type public.points_store_item_type NOT NULL DEFAULT 'PHYSICAL',
  status    public.points_store_item_status NOT NULL DEFAULT 'DRAFT',
  featured  boolean NOT NULL DEFAULT false,
  estimated_days integer,
  free_shipping  boolean NOT NULL DEFAULT false,
  weight_g integer,
  dimensions jsonb,
  supplier text,
  on_demand boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (stock_reserved <= stock_total)
);
GRANT SELECT ON public.points_store_items TO authenticated;
GRANT ALL    ON public.points_store_items TO service_role;
ALTER TABLE public.points_store_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_read_active" ON public.points_store_items FOR SELECT TO authenticated
  USING (status IN ('ACTIVE','PAUSED','OUT_OF_STOCK') OR public.is_admin_user(auth.uid()));
CREATE POLICY "items_admin_all" ON public.points_store_items FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

-- Imagens ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_store_item_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.points_store_items(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_store_item_images TO authenticated;
GRANT ALL    ON public.points_store_item_images TO service_role;
ALTER TABLE public.points_store_item_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imgs_read"      ON public.points_store_item_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "imgs_admin_all" ON public.points_store_item_images FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

-- Auditoria de preço -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_store_item_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.points_store_items(id) ON DELETE CASCADE,
  old_cost_points bigint,
  new_cost_points bigint NOT NULL,
  admin_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_store_item_price_history TO authenticated;
GRANT ALL    ON public.points_store_item_price_history TO service_role;
ALTER TABLE public.points_store_item_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_hist_admin" ON public.points_store_item_price_history FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public._points_price_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cost_points IS DISTINCT FROM OLD.cost_points THEN
    INSERT INTO public.points_store_item_price_history(item_id, old_cost_points, new_cost_points, admin_id)
    VALUES (NEW.id, OLD.cost_points, NEW.cost_points, auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_price_hist ON public.points_store_items;
CREATE TRIGGER trg_price_hist AFTER UPDATE OF cost_points ON public.points_store_items
  FOR EACH ROW EXECUTE FUNCTION public._points_price_history();

-- Estoque ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_store_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.points_store_items(id),
  movement_type public.points_inventory_movement_type NOT NULL,
  quantity_delta integer NOT NULL,
  stock_before integer NOT NULL,
  stock_after  integer NOT NULL,
  redemption_id uuid,
  admin_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_store_inventory_movements TO authenticated;
GRANT ALL    ON public.points_store_inventory_movements TO service_role;
ALTER TABLE public.points_store_inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_admin_all" ON public.points_store_inventory_movements FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

-- Pedidos ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.points_redemptions_order_seq;

CREATE TABLE IF NOT EXISTS public.points_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE
    DEFAULT ('PSL-' || lpad(nextval('public.points_redemptions_order_seq')::text, 6, '0')),
  user_id uuid NOT NULL,
  status public.points_redemption_status NOT NULL DEFAULT 'PENDING',
  total_points bigint NOT NULL CHECK (total_points > 0),
  shipping_address_snapshot jsonb,
  shipping_method text,
  shipping_cost numeric(12,2) DEFAULT 0,
  tracking_code text,
  carrier text,
  admin_notes text,
  approved_by uuid,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_redemptions TO authenticated;
GRANT ALL    ON public.points_redemptions TO service_role;
ALTER TABLE public.points_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "red_self_read" ON public.points_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));
CREATE POLICY "red_admin_all" ON public.points_redemptions FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.points_redemption_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_id uuid NOT NULL REFERENCES public.points_redemptions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.points_store_items(id),
  item_snapshot jsonb NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  points_unit  bigint NOT NULL,
  points_total bigint NOT NULL,
  internal_cost_snapshot numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_redemption_items TO authenticated;
GRANT ALL    ON public.points_redemption_items TO service_role;
ALTER TABLE public.points_redemption_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "red_items_self" ON public.points_redemption_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.points_redemptions r
                  WHERE r.id = redemption_id
                    AND (r.user_id = auth.uid() OR public.is_admin_user(auth.uid()))));

CREATE TABLE IF NOT EXISTS public.points_redemption_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_id uuid NOT NULL REFERENCES public.points_redemptions(id) ON DELETE CASCADE,
  old_status public.points_redemption_status,
  new_status public.points_redemption_status NOT NULL,
  actor uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_redemption_status_history TO authenticated;
GRANT ALL    ON public.points_redemption_status_history TO service_role;
ALTER TABLE public.points_redemption_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "red_hist_admin_or_self" ON public.points_redemption_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.points_redemptions r
                  WHERE r.id = redemption_id
                    AND (r.user_id = auth.uid() OR public.is_admin_user(auth.uid()))));

-- Audiência ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_visible_for(p_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_program boolean; v_store boolean; v_mode text; v_ids jsonb; v_pct int;
BEGIN
  SELECT setting_value INTO v_program FROM public.points_program_settings_bool
   WHERE setting_key='points_program_enabled';
  SELECT setting_value INTO v_store   FROM public.points_program_settings_bool
   WHERE setting_key='points_store_enabled';
  IF COALESCE(v_program,false)=false OR COALESCE(v_store,false)=false THEN RETURN false; END IF;

  SELECT setting_value::text INTO v_mode FROM public.points_program_settings_json
   WHERE setting_key='audience_mode';
  IF public.is_admin_user(p_user) THEN RETURN true; END IF;

  v_mode := COALESCE(trim(both '"' from v_mode), 'admin_only');
  IF v_mode = 'admin_only' THEN RETURN false;
  ELSIF v_mode = 'all' THEN RETURN true;
  ELSIF v_mode = 'pilot' THEN
    SELECT setting_value INTO v_ids FROM public.points_program_settings_json
     WHERE setting_key='audience_pilot_user_ids';
    RETURN v_ids IS NOT NULL AND v_ids ? p_user::text;
  ELSIF v_mode = 'percent' THEN
    SELECT setting_value INTO v_pct FROM public.points_program_settings_num
     WHERE setting_key='audience_percent';
    RETURN (('x'||substr(md5(p_user::text),1,8))::bit(32)::int % 100) < COALESCE(v_pct,0);
  END IF;
  RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION public.store_visible_for(uuid) TO authenticated;

-- Redemption RPCs ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_create(
  p_items jsonb, p_shipping jsonb, p_idem text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_store_on boolean; v_redeem_on boolean;
  v_total bigint := 0;
  v_red_id uuid;
  it jsonb; v_item record; v_qty int; v_stock_before int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.store_visible_for(v_user) THEN RAISE EXCEPTION 'store_not_visible'; END IF;

  SELECT setting_value INTO v_store_on  FROM public.points_program_settings_bool WHERE setting_key='points_store_enabled';
  SELECT setting_value INTO v_redeem_on FROM public.points_program_settings_bool WHERE setting_key='points_redemption_enabled';
  IF COALESCE(v_store_on,false)=false OR COALESCE(v_redeem_on,false)=false THEN RAISE EXCEPTION 'store_disabled'; END IF;

  INSERT INTO public.points_redemptions(user_id, total_points, shipping_address_snapshot, idempotency_key)
  VALUES (v_user, 0, p_shipping, p_idem)
  RETURNING id INTO v_red_id;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((it->>'quantity')::int, 1);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;

    SELECT * INTO v_item FROM public.points_store_items
     WHERE id = (it->>'item_id')::uuid FOR UPDATE;
    IF NOT FOUND OR v_item.status <> 'ACTIVE' THEN RAISE EXCEPTION 'item_unavailable:%', it->>'item_id'; END IF;
    IF v_item.stock_available < v_qty THEN RAISE EXCEPTION 'insufficient_stock:%', v_item.id; END IF;
    IF v_item.per_user_limit IS NOT NULL THEN
      IF (SELECT COALESCE(SUM(ri.quantity),0)
            FROM public.points_redemption_items ri
            JOIN public.points_redemptions r ON r.id = ri.redemption_id
           WHERE r.user_id = v_user AND ri.item_id = v_item.id
             AND r.status NOT IN ('REJECTED','CANCELLED','REVERSED')) + v_qty > v_item.per_user_limit THEN
        RAISE EXCEPTION 'per_user_limit_exceeded:%', v_item.id;
      END IF;
    END IF;

    v_stock_before := v_item.stock_reserved;
    UPDATE public.points_store_items SET stock_reserved = stock_reserved + v_qty, updated_at = now()
     WHERE id = v_item.id;
    INSERT INTO public.points_store_inventory_movements(
      item_id, movement_type, quantity_delta, stock_before, stock_after, redemption_id, reason)
    VALUES (v_item.id, 'RESERVE', v_qty, v_stock_before, v_stock_before + v_qty, v_red_id, 'redemption pending');

    INSERT INTO public.points_redemption_items(
      redemption_id, item_id, item_snapshot, quantity, points_unit, points_total, internal_cost_snapshot)
    VALUES (v_red_id, v_item.id, to_jsonb(v_item),
            v_qty, v_item.cost_points, v_item.cost_points * v_qty, v_item.internal_cost_brl);

    v_total := v_total + v_item.cost_points * v_qty;
  END LOOP;

  PERFORM public.points_reserve(v_user, v_total, v_red_id, 'redeem:'||v_red_id::text);

  UPDATE public.points_redemptions SET total_points = v_total, updated_at = now() WHERE id = v_red_id;
  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (v_red_id, NULL, 'PENDING', v_user, 'created');
  RETURN v_red_id;
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_create(jsonb, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_approve(
  p_redemption uuid, p_admin uuid, p_notes text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; it record; v_before int; BEGIN
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO r FROM public.points_redemptions WHERE id = p_redemption FOR UPDATE;
  IF r.status <> 'PENDING' THEN RAISE EXCEPTION 'not_pending'; END IF;

  PERFORM public.points_confirm_reservation(r.user_id, r.total_points, r.id, 'confirm:'||r.id::text);

  FOR it IN SELECT * FROM public.points_redemption_items WHERE redemption_id = r.id LOOP
    SELECT stock_total INTO v_before FROM public.points_store_items WHERE id = it.item_id FOR UPDATE;
    UPDATE public.points_store_items
       SET stock_total    = stock_total    - it.quantity,
           stock_reserved = stock_reserved - it.quantity,
           updated_at = now()
     WHERE id = it.item_id;
    INSERT INTO public.points_store_inventory_movements(
      item_id, movement_type, quantity_delta, stock_before, stock_after, redemption_id, admin_id, reason)
    VALUES (it.item_id, 'REDEMPTION', -it.quantity, v_before, v_before - it.quantity, r.id, p_admin, 'approved');
  END LOOP;

  UPDATE public.points_redemptions
     SET status='APPROVED', approved_by=p_admin, approved_at=now(),
         admin_notes = COALESCE(admin_notes,'') || COALESCE(' '||p_notes,''),
         updated_at=now()
   WHERE id = r.id;
  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (r.id, 'PENDING', 'APPROVED', p_admin, p_notes);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_reject(
  p_redemption uuid, p_admin uuid, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; it record; v_before int; BEGIN
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO r FROM public.points_redemptions WHERE id = p_redemption FOR UPDATE;
  IF r.status <> 'PENDING' THEN RAISE EXCEPTION 'not_pending'; END IF;

  PERFORM public.points_release_reservation(r.user_id, r.total_points, r.id, 'release:'||r.id::text);

  FOR it IN SELECT * FROM public.points_redemption_items WHERE redemption_id = r.id LOOP
    SELECT stock_reserved INTO v_before FROM public.points_store_items WHERE id = it.item_id FOR UPDATE;
    UPDATE public.points_store_items
       SET stock_reserved = stock_reserved - it.quantity, updated_at = now()
     WHERE id = it.item_id;
    INSERT INTO public.points_store_inventory_movements(
      item_id, movement_type, quantity_delta, stock_before, stock_after, redemption_id, admin_id, reason)
    VALUES (it.item_id, 'RELEASE', -it.quantity, v_before, v_before - it.quantity, r.id, p_admin, p_reason);
  END LOOP;

  UPDATE public.points_redemptions
     SET status='REJECTED', rejected_at=now(),
         admin_notes = COALESCE(admin_notes,'') || COALESCE(' '||p_reason,''),
         updated_at=now()
   WHERE id = r.id;
  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (r.id, 'PENDING', 'REJECTED', p_admin, p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_cancel(
  p_redemption uuid, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; it record; v_before int; v_actor uuid := auth.uid(); BEGIN
  SELECT * INTO r FROM public.points_redemptions WHERE id = p_redemption FOR UPDATE;
  IF r.status <> 'PENDING' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF r.user_id <> v_actor AND NOT public.is_admin_user(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;

  PERFORM public.points_release_reservation(r.user_id, r.total_points, r.id, 'release:'||r.id::text);
  FOR it IN SELECT * FROM public.points_redemption_items WHERE redemption_id = r.id LOOP
    SELECT stock_reserved INTO v_before FROM public.points_store_items WHERE id = it.item_id FOR UPDATE;
    UPDATE public.points_store_items SET stock_reserved = stock_reserved - it.quantity WHERE id = it.item_id;
    INSERT INTO public.points_store_inventory_movements(
      item_id, movement_type, quantity_delta, stock_before, stock_after, redemption_id, admin_id, reason)
    VALUES (it.item_id, 'CANCELLATION', -it.quantity, v_before, v_before - it.quantity, r.id, v_actor, p_reason);
  END LOOP;

  UPDATE public.points_redemptions SET status='CANCELLED', cancelled_at=now(), updated_at=now() WHERE id = r.id;
  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (r.id, 'PENDING', 'CANCELLED', v_actor, p_reason);
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_cancel(uuid, text) TO authenticated;

COMMIT;
