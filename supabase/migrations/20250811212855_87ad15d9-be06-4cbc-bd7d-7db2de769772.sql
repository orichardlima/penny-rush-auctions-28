-- Remove the every-second cron job as it conflicts with bid resets
SELECT cron.unschedule('update-auction-timers');

-- Keep only the cleanup job that runs every minute to finalize expired auctions
SELECT cron.schedule(
  'cleanup-expired-auctions',
  '* * * * *', -- Every minute
  $$
  SELECT public.cleanup_expired_auctions();
  $$
);