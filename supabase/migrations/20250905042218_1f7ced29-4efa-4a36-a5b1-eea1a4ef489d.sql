-- Fix the timer reset bug by removing all existing cron jobs and setting up correct ones

-- 1. Remove ALL existing cron jobs to start clean
DELETE FROM cron.job;

-- 2. Set up the correct timer synchronization - every 2 seconds for sync-timers-and-protection
SELECT cron.schedule(
  'auction-timer-sync',
  '*/2 * * * * *', -- every 2 seconds
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQ1NjQ3MywiZXhwIjoyMDY5MDMyNDczfQ.KBIpym8v35ohJp1z00BfzlqeNLt0ZhlU5YM8-ai7oGs"}'::jsonb
  ) as request_id;
  $$
);

-- 3. Set up revenue protection to run every 5 seconds (less frequent to avoid conflicts)
SELECT cron.schedule(
  'revenue-protection',
  '*/5 * * * * *', -- every 5 seconds  
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/revenue-protection-system',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQ1NjQ3MywiZXhwIjoyMDY5MDMyNDczfQ.KBIpym8v35ohJp1z00BfzlqeNLt0ZhlU5YM8-ai7oGs"}'::jsonb
  ) as request_id;
  $$
);