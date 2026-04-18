
CREATE OR REPLACE FUNCTION public.trg_refresh_last_bidders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rebuild_auction_last_bidders(NEW.auction_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bids_refresh_last_bidders ON public.bids;
CREATE TRIGGER bids_refresh_last_bidders
AFTER INSERT ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_last_bidders();
