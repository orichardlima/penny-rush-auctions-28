-- Remove existing broken cron jobs
DELETE FROM cron.job WHERE jobname LIKE '%revenue-protection%' OR jobname LIKE '%auction-protection%';

-- Create new ultra-fast protection system (every 1 second)
SELECT cron.schedule(
  'real-time-auction-protection', 
  '* * * * * *',  -- Every second
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb,
    body := '{"trigger": "cron", "interval": "1s"}'::jsonb
  );
  $$
);