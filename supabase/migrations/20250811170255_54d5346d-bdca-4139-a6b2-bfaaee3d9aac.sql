-- Remove the duplicate trigger that's causing double webhook calls
DROP TRIGGER IF EXISTS tr_auctions_after_update_webhook ON public.auctions;

-- Verify we still have the main trigger (this should remain)
-- auction_status_webhook_trigger should be the only one calling trigger_auction_webhook()