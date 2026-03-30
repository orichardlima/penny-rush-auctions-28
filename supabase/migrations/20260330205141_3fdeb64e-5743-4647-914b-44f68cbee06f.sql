
SELECT cron.schedule(
  'release-referral-bonuses',
  '0 * * * *',
  $$SELECT public.release_pending_referral_bonuses()$$
);
