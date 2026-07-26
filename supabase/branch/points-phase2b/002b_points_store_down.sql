-- Rollback Fase 2B
BEGIN;

DROP FUNCTION IF EXISTS public.redeem_cancel(uuid,text);
DROP FUNCTION IF EXISTS public.redeem_reject(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.redeem_approve(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.redeem_create(jsonb,jsonb,text);
DROP FUNCTION IF EXISTS public.store_visible_for(uuid);

DROP TRIGGER  IF EXISTS trg_price_hist ON public.points_store_items;
DROP FUNCTION IF EXISTS public._points_price_history();

DROP TABLE IF EXISTS public.points_redemption_status_history;
DROP TABLE IF EXISTS public.points_redemption_items;
DROP TABLE IF EXISTS public.points_redemptions;
DROP SEQUENCE IF EXISTS public.points_redemptions_order_seq;
DROP TABLE IF EXISTS public.points_store_inventory_movements;
DROP TABLE IF EXISTS public.points_store_item_price_history;
DROP TABLE IF EXISTS public.points_store_item_images;
DROP TABLE IF EXISTS public.points_store_items;
DROP TABLE IF EXISTS public.points_store_categories;

DROP TYPE IF EXISTS public.points_redemption_status;
DROP TYPE IF EXISTS public.points_inventory_movement_type;
DROP TYPE IF EXISTS public.points_store_item_type;
DROP TYPE IF EXISTS public.points_store_item_status;

COMMIT;
