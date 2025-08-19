-- Corrigir a função prevent_bids_on_inactive_auctions que deve estar faltando search_path

CREATE OR REPLACE FUNCTION public.prevent_bids_on_inactive_auctions()
RETURNS trigger
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

  IF a.status <> 'active' OR (a.ends_at IS NOT NULL AND a.ends_at <= timezone('America/Sao_Paulo', now())) OR COALESCE(a.time_left, 0) <= 0 THEN
    RAISE EXCEPTION 'Cannot place bids on inactive or finished auctions';
  END IF;

  RETURN NEW;
END;
$function$;