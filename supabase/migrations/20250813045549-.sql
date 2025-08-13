-- 1) Function to return current server time for client offset sync
CREATE OR REPLACE FUNCTION public.current_server_time()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT now();
$$;

-- 2) Ensure realtime captures full row data (safe if already set)
ALTER TABLE public.auctions REPLICA IDENTITY FULL;
ALTER TABLE public.bids REPLICA IDENTITY FULL;

-- 3) Add tables to realtime publication (idempotent)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.bids;

-- 4) Triggers wiring
-- Prevent bids on inactive auctions
DROP TRIGGER IF EXISTS trg_bids_prevent_inactive ON public.bids;
CREATE TRIGGER trg_bids_prevent_inactive
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bids_on_inactive_auctions();

-- Update auction stats when a new bid is inserted
DROP TRIGGER IF EXISTS trg_bids_update_stats ON public.bids;
CREATE TRIGGER trg_bids_update_stats
AFTER INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.update_auction_stats();

-- Set ends_at/time_left when auction becomes active
DROP TRIGGER IF EXISTS trg_auctions_set_end_time ON public.auctions;
CREATE TRIGGER trg_auctions_set_end_time
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.set_auction_end_time();

-- Lock finished auctions from being modified/reactivated
DROP TRIGGER IF EXISTS trg_auctions_lock_finished ON public.auctions;
CREATE TRIGGER trg_auctions_lock_finished
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.lock_finished_auctions();

-- Finalize auction when time_left hits zero (server authoritative)
DROP TRIGGER IF EXISTS trg_auctions_finalize_on_zero ON public.auctions;
CREATE TRIGGER trg_auctions_finalize_on_zero
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.finalize_auction_on_timer_zero();

-- Auto update updated_at on any auction change
DROP TRIGGER IF EXISTS trg_auctions_updated_at ON public.auctions;
CREATE TRIGGER trg_auctions_updated_at
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger webhook when auction transitions to active
DROP TRIGGER IF EXISTS trg_auctions_activation_webhook ON public.auctions;
CREATE TRIGGER trg_auctions_activation_webhook
AFTER UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_auction_webhook();