-- ROLLBACK completo da Fase 1 v3 (uso em branch apenas).
-- Como nenhuma flag foi ativada e nenhum dado histórico foi tocado, o rollback
-- é DROP puro + restauração do place_bid original.

DROP FUNCTION IF EXISTS public.place_bid_as(uuid,uuid,uuid);
DROP FUNCTION IF EXISTS public.consume_bid_lots_for_bid(uuid,numeric,uuid);
DROP FUNCTION IF EXISTS public.commit_bid_lot_consumptions(uuid,json);
DROP FUNCTION IF EXISTS public.preview_consume_bid_lots(uuid,numeric);
DROP FUNCTION IF EXISTS public.points_admin_set_bool(text,boolean);
DROP FUNCTION IF EXISTS public.points_admin_set_num(text,numeric);
DROP FUNCTION IF EXISTS public.points_admin_set_time(text,timestamptz);
DROP FUNCTION IF EXISTS public.points_admin_set_json(text,jsonb);
DROP FUNCTION IF EXISTS public.points_get_bool(text,boolean);
DROP FUNCTION IF EXISTS public.points_get_num(text,numeric);
DROP FUNCTION IF EXISTS public.points_get_time(text);
DROP FUNCTION IF EXISTS public.points_get_json(text);

-- Restaurar place_bid original (baseline capturado em prod)
CREATE OR REPLACE FUNCTION public.place_bid(p_auction_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $function$
DECLARE
  v_balance numeric;
BEGIN
  SELECT bids_balance INTO v_balance
  FROM profiles WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < 1 THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;
  PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
  UPDATE profiles SET bids_balance = bids_balance - 1 WHERE user_id = p_user_id;
  PERFORM set_config('app.allow_sensitive_profile_update', '', true);
  INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
  VALUES (p_auction_id, p_user_id, 1, 1.00);
END;
$function$;

DROP TABLE IF EXISTS public.bid_lot_consumptions;
DROP TABLE IF EXISTS public.points_bid_reconciliation_queue;
DROP TABLE IF EXISTS public.points_program_settings_audit;
DROP TABLE IF EXISTS public.points_program_settings_bool;
DROP TABLE IF EXISTS public.points_program_settings_num;
DROP TABLE IF EXISTS public.points_program_settings_time;
DROP TABLE IF EXISTS public.points_program_settings_json;

ALTER TABLE public.bids
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS lot_id,
  DROP COLUMN IF EXISTS eligible_for_points,
  DROP COLUMN IF EXISTS is_test,
  DROP COLUMN IF EXISTS points_rule_id,
  DROP COLUMN IF EXISTS points_campaign_id,
  DROP COLUMN IF EXISTS points_multiplier_snapshot,
  DROP COLUMN IF EXISTS audience_version_snapshot,
  DROP COLUMN IF EXISTS points_program_active_at_bid,
  DROP COLUMN IF EXISTS points_accrual_active_at_bid,
  DROP COLUMN IF EXISTS accrual_started_at_snapshot,
  DROP COLUMN IF EXISTS tracking_status;

ALTER TABLE public.bid_lots
  DROP COLUMN IF EXISTS eligible_for_points,
  DROP COLUMN IF EXISTS payment_gateway,
  DROP COLUMN IF EXISTS external_payment_id,
  DROP COLUMN IF EXISTS bid_purchase_id,
  DROP COLUMN IF EXISTS purchased_at,
  DROP COLUMN IF EXISTS idempotency_key;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_test_account;
