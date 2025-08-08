-- Create triggers to enforce auction finality and prevent invalid bids

-- Prevent placing bids on inactive/finished auctions
DROP TRIGGER IF EXISTS trg_prevent_bids_on_inactive ON public.bids;
CREATE TRIGGER trg_prevent_bids_on_inactive
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bids_on_inactive_auctions();

-- Lock finished auctions from being reactivated or timer-changed
DROP TRIGGER IF EXISTS trg_lock_finished_auctions ON public.auctions;
CREATE TRIGGER trg_lock_finished_auctions
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.lock_finished_auctions();