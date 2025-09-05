-- Fix the timer reset bug by correcting the cron job and timer logic

-- 1. First, remove the incorrect cron job that calls non-existent auction-countdown function
SELECT cron.unschedule('invoke-function-every-minute') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE command LIKE '%auction-countdown%'
);

-- 2. Remove any existing timer-related cron jobs to start clean
DELETE FROM cron.job WHERE command LIKE '%sync-timers-and-protection%';
DELETE FROM cron.job WHERE command LIKE '%revenue-protection-system%';

-- 3. Set up the correct timer synchronization - every 2 seconds for sync-timers-and-protection
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

-- 4. Set up revenue protection to run every 3 seconds (less frequent to avoid conflicts)
SELECT cron.schedule(
  'revenue-protection',
  '*/3 * * * * *', -- every 3 seconds  
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/revenue-protection-system',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQ1NjQ3MywiZXhwIjoyMDY5MDMyNDczfQ.KBIpym8v35ohJp1z00BfzlqeNLt0ZhlU5YM8-ai7oGs"}'::jsonb
  ) as request_id;
  $$
);

-- 5. Log the fix
RAISE LOG '[TIMER-FIX] Corrigido sistema de timer - removido cron job inválido e configurados timers corretos';