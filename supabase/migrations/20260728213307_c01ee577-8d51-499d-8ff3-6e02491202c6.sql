
-- Wrapper seguro: nunca propaga exceção para o UPDATE do leilão
CREATE OR REPLACE FUNCTION public.points_settle_auction_safe(p_auction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.points_settle_auction(p_auction_id, NULL, 'auto_on_finish');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'points_settle_auction_safe failed for %: %', p_auction_id, SQLERRM;
  END;
END;
$$;

-- Trigger: quando o leilão vira "finished", assenta os pontos
CREATE OR REPLACE FUNCTION public.trg_points_settle_on_auction_finish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') THEN
    PERFORM public.points_settle_auction_safe(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_points_settle_on_auction_finish ON public.auctions;
CREATE TRIGGER trg_points_settle_on_auction_finish
AFTER UPDATE OF status ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.trg_points_settle_on_auction_finish();

-- Varredura: reprocessa leilões finalizados sem entrada em auction_points_settlements
CREATE OR REPLACE FUNCTION public.points_settle_pending_auctions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz;
  r record;
  n integer := 0;
BEGIN
  SELECT value INTO v_cutoff
    FROM public.points_program_settings_time
   WHERE key='points_accrual_started_at';

  IF v_cutoff IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT a.id
      FROM public.auctions a
     WHERE a.status = 'finished'
       AND a.finished_at >= v_cutoff
       AND NOT EXISTS (
         SELECT 1 FROM public.auction_points_settlements s
          WHERE s.auction_id = a.id
       )
     ORDER BY a.finished_at ASC
     LIMIT 200
  LOOP
    PERFORM public.points_settle_auction_safe(r.id);
    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.points_settle_pending_auctions() TO service_role;
