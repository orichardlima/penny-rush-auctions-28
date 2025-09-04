-- Configurar cron job para countdown automático (executa a cada segundo)
SELECT cron.schedule(
  'auction-countdown-timer',
  '* * * * * *',  -- A cada segundo (segundo, minuto, hora, dia, mês, dia da semana)
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/auction-countdown',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQ1NjQ3MywiZXhwIjoyMDY5MDMyNDczfQ.KBIpym8v35ohJp1z00BfzlqeNLt0ZhlU5YM8-ai7oGs"}'::jsonb
  ) as request_id;
  $$
);