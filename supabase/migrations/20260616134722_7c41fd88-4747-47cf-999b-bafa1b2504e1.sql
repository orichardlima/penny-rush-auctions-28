CREATE OR REPLACE FUNCTION public.cleanup_old_bids_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
  v_remaining bigint;
BEGIN
  DELETE FROM public.bids
  WHERE id IN (
    SELECT b.id FROM public.bids b
    JOIN public.auctions a ON a.id = b.auction_id
    WHERE a.status = 'finished'
      AND a.finished_at < now() - interval '30 days'
    LIMIT 30000
  );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'cleanup_old_bids_batch: deleted % rows', v_deleted;

  IF v_deleted = 0 THEN
    PERFORM cron.unschedule('cleanup-old-bids');
    RAISE NOTICE 'cleanup_old_bids_batch: done, unscheduled job';
  END IF;
END;
$$;

SELECT cron.schedule(
  'cleanup-old-bids',
  '* * * * *',
  $$SELECT public.cleanup_old_bids_batch();$$
);