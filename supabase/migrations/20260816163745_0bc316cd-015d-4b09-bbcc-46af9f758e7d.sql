
DROP POLICY IF EXISTS "red_items_admin" ON public.points_redemption_items;
CREATE POLICY "red_items_admin" ON public.points_redemption_items
FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.redeem_mark_shipped(
  p_redemption uuid, p_admin uuid, p_tracking text DEFAULT NULL, p_carrier text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; BEGIN
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO r FROM public.points_redemptions WHERE id = p_redemption FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.status NOT IN ('APPROVED','SEPARATING') THEN RAISE EXCEPTION 'invalid_status'; END IF;

  UPDATE public.points_redemptions
     SET status='SHIPPED', shipped_at=now(),
         tracking_code=COALESCE(p_tracking, tracking_code),
         carrier=COALESCE(p_carrier, carrier),
         updated_at=now()
   WHERE id = r.id;

  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (r.id, r.status, 'SHIPPED', p_admin, COALESCE(p_carrier,'') || CASE WHEN p_tracking IS NOT NULL THEN ' '||p_tracking ELSE '' END);
END $function$;

CREATE OR REPLACE FUNCTION public.redeem_mark_delivered(
  p_redemption uuid, p_admin uuid, p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; BEGIN
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO r FROM public.points_redemptions WHERE id = p_redemption FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.status <> 'SHIPPED' THEN RAISE EXCEPTION 'invalid_status'; END IF;

  UPDATE public.points_redemptions
     SET status='DELIVERED', delivered_at=now(), updated_at=now()
   WHERE id = r.id;

  INSERT INTO public.points_redemption_status_history(redemption_id, old_status, new_status, actor, reason)
  VALUES (r.id, 'SHIPPED', 'DELIVERED', p_admin, p_notes);
END $function$;

REVOKE ALL ON FUNCTION public.redeem_mark_shipped(uuid, uuid, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.redeem_mark_delivered(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_mark_shipped(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_mark_delivered(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.points_redemption_notify_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_title text; v_msg text; BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  CASE NEW.status::text
    WHEN 'APPROVED'   THEN v_title := 'Resgate aprovado';
                           v_msg := 'Seu pedido ' || NEW.order_number || ' foi aprovado e entrará em separação.';
    WHEN 'REJECTED'   THEN v_title := 'Resgate rejeitado';
                           v_msg := 'Seu pedido ' || NEW.order_number || ' foi rejeitado e os pontos foram devolvidos.';
    WHEN 'SEPARATING' THEN v_title := 'Pedido em separação';
                           v_msg := 'Seu pedido ' || NEW.order_number || ' está em separação.';
    WHEN 'SHIPPED'    THEN v_title := 'Pedido enviado';
                           v_msg := 'Seu pedido ' || NEW.order_number || ' foi enviado' ||
                                    COALESCE(' pela ' || NEW.carrier, '') ||
                                    COALESCE('. Rastreio: ' || NEW.tracking_code, '') || '.';
    WHEN 'DELIVERED'  THEN v_title := 'Pedido entregue';
                           v_msg := 'Seu pedido ' || NEW.order_number || ' foi entregue. Bom proveito!';
    WHEN 'CANCELLED'  THEN v_title := 'Resgate cancelado';
                           v_msg := 'Seu pedido ' || NEW.order_number || ' foi cancelado e os pontos foram devolvidos.';
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO public.notifications(user_id, type, title, message, link, metadata)
  VALUES (NEW.user_id, 'redemption_status', v_title, v_msg, '/meus-resgates',
          jsonb_build_object('redemption_id', NEW.id, 'status', NEW.status::text, 'order_number', NEW.order_number));
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_points_redemption_notify ON public.points_redemptions;
CREATE TRIGGER trg_points_redemption_notify
AFTER UPDATE OF status ON public.points_redemptions
FOR EACH ROW EXECUTE FUNCTION public.points_redemption_notify_status();
