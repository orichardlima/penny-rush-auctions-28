-- Update cron job to run every second instead of every minute
SELECT cron.unschedule('update-auction-timers');

SELECT cron.schedule(
  'update-auction-timers',
  '* * * * * *', -- Every second (added 6th asterisk)
  $$
  SELECT public.update_auction_timers();
  $$
);