-- Rollback simétrico Fase 3 v2 (BRANCH)
BEGIN;

DROP FUNCTION IF EXISTS public.points_admin_activate_pilot(uuid,timestamptz,uuid[],text);

DROP TRIGGER IF EXISTS trg_points_audit_audience ON public.points_program_settings_json;
DROP FUNCTION IF EXISTS public.points_audit_audience_change();

DROP FUNCTION IF EXISTS public.reverse_paid_bid_purchase(uuid,text,text,numeric,text);

DROP TRIGGER IF EXISTS trg_points_wallet_no_negative ON public.points_wallets;
DROP FUNCTION IF EXISTS public.points_ledger_prevent_negative_wallet();

DROP TABLE IF EXISTS public.payment_reversal_events;
DROP TABLE IF EXISTS public.points_reversal_cases;

DROP FUNCTION IF EXISTS public.points_canonical_credit_active();
DROP FUNCTION IF EXISTS public.credit_paid_bid_purchase(
  uuid,uuid,integer,numeric,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz);

DROP FUNCTION IF EXISTS public.points_user_in_audience(uuid);
DROP FUNCTION IF EXISTS public.points_audience_version();
DROP FUNCTION IF EXISTS public.points_audience_mode();
DELETE FROM public.points_program_settings_json
 WHERE key IN ('audience_mode','audience_version','pilot_audience','webhooks_validated');

ALTER TABLE public.bid_purchases
  DROP COLUMN IF EXISTS canonical_lot_id,
  DROP COLUMN IF EXISTS credited_via_canonical_rpc,
  DROP COLUMN IF EXISTS processed_at,
  DROP COLUMN IF EXISTS webhook_received_at,
  DROP COLUMN IF EXISTS payment_confirmed_at,
  DROP COLUMN IF EXISTS payment_created_at,
  DROP COLUMN IF EXISTS gateway_payload_hash,
  DROP COLUMN IF EXISTS gateway_event_id,
  DROP COLUMN IF EXISTS gateway_account_id,
  DROP COLUMN IF EXISTS payment_environment;

ALTER TABLE public.bid_lots
  DROP COLUMN IF EXISTS lot_status,
  DROP COLUMN IF EXISTS credited_via_canonical_rpc,
  DROP COLUMN IF EXISTS payment_eligible_for_points,
  DROP COLUMN IF EXISTS processed_at,
  DROP COLUMN IF EXISTS webhook_received_at,
  DROP COLUMN IF EXISTS payment_confirmed_at,
  DROP COLUMN IF EXISTS payment_created_at,
  DROP COLUMN IF EXISTS bid_purchase_id,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS gateway_payload_hash,
  DROP COLUMN IF EXISTS gateway_event_id,
  DROP COLUMN IF EXISTS external_payment_id,
  DROP COLUMN IF EXISTS gateway_account_id,
  DROP COLUMN IF EXISTS payment_gateway,
  DROP COLUMN IF EXISTS payment_environment;

DROP INDEX IF EXISTS public.bid_lots_payment_ident_uidx;
DROP INDEX IF EXISTS public.bid_lots_idempotency_key_uidx;

ALTER TABLE public.bids DROP COLUMN IF EXISTS points_rule_id;

DROP TRIGGER IF EXISTS trg_points_rules_no_delete   ON public.points_rules;
DROP TRIGGER IF EXISTS trg_points_rules_immutable   ON public.points_rules;
DROP FUNCTION IF EXISTS public.points_rules_prevent_delete();
DROP FUNCTION IF EXISTS public.points_rules_prevent_material_update();
DROP FUNCTION IF EXISTS public.points_rule_has_dependencies(uuid);
DROP INDEX IF EXISTS public.points_rules_one_active_per_code;
DROP TABLE IF EXISTS public.points_rules;

DROP FUNCTION IF EXISTS public.points_is_admin(uuid);

COMMIT;
