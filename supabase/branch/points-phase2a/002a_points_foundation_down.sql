-- Rollback Fase 2A
BEGIN;

DROP FUNCTION IF EXISTS public.points_admin_adjust(uuid,bigint,text,uuid,text);
DROP FUNCTION IF EXISTS public.points_release_reservation(uuid,bigint,uuid,text);
DROP FUNCTION IF EXISTS public.points_confirm_reservation(uuid,bigint,uuid,text);
DROP FUNCTION IF EXISTS public.points_reserve(uuid,bigint,uuid,text);
DROP FUNCTION IF EXISTS public.points_reverse_settlement(uuid,text);
DROP FUNCTION IF EXISTS public.points_settle_auction(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.is_auction_final_for_points(uuid);
DROP FUNCTION IF EXISTS public._points_ensure_wallet(uuid);

DROP TRIGGER IF EXISTS trg_points_ledger_no_update ON public.points_ledger;
DROP FUNCTION IF EXISTS public.points_ledger_block_mutations();

DROP TABLE IF EXISTS public.auction_points_settlement_items;
DROP TABLE IF EXISTS public.auction_points_settlements;
DROP TABLE IF EXISTS public.points_accrual_buckets;
DROP TABLE IF EXISTS public.points_ledger;
DROP TABLE IF EXISTS public.points_wallets;
DROP TABLE IF EXISTS public.points_rules;

DROP TYPE IF EXISTS public.points_settlement_status;
DROP TYPE IF EXISTS public.points_ledger_type;
DROP TYPE IF EXISTS public.points_wallet_status;

-- profiles.is_test_account intentionally kept (compatível com Fase 1)
COMMIT;
