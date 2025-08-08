-- Prevent placing bids on inactive/finished auctions
CREATE OR REPLACE FUNCTION public.prevent_bids_on_inactive_auctions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  a RECORD;
BEGIN
  SELECT id, status, ends_at, time_left INTO a
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  IF a.status <> 'active' OR (a.ends_at IS NOT NULL AND a.ends_at <= now()) OR COALESCE(a.time_left, 0) <= 0 THEN
    RAISE EXCEPTION 'Cannot place bids on inactive or finished auctions';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_bids_on_inactive ON public.bids;
CREATE TRIGGER trg_prevent_bids_on_inactive
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bids_on_inactive_auctions();

-- Lock finished auctions from being reactivated or timer-changed
CREATE OR REPLACE FUNCTION public.lock_finished_auctions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status = 'finished' AND NEW.status IS DISTINCT FROM 'finished' THEN
    RAISE EXCEPTION 'Finished auctions cannot be reactivated';
  END IF;

  IF OLD.status = 'finished' AND (
    NEW.ends_at IS DISTINCT FROM OLD.ends_at OR
    NEW.time_left IS DISTINCT FROM OLD.time_left
  ) THEN
    RAISE EXCEPTION 'Finished auctions cannot change timer';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_lock_finished_auctions ON public.auctions;
CREATE TRIGGER trg_lock_finished_auctions
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.lock_finished_auctions();