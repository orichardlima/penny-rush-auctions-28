-- 1. Primeiro, corrigir a função ensure_bot_user para usar bots fixos
-- Criar bots fixos na tabela profiles sem dependência de auth.users

-- Inserir bots fixos se não existirem
INSERT INTO public.profiles (
  user_id, 
  full_name, 
  email, 
  bids_balance,
  is_admin
) 
SELECT 
  gen_random_uuid(),
  'Bot ' || i,
  'bot' || i || '@sistema.local',
  999999999,  -- Saldo infinito para bots
  false
FROM generate_series(1, 50) AS i
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE email LIKE 'bot%@sistema.local'
);

-- Recriar a função ensure_bot_user para usar os bots fixos
CREATE OR REPLACE FUNCTION public.ensure_bot_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  bot_user_id uuid;
BEGIN
  -- Buscar um bot existente aleatoriamente
  SELECT user_id INTO bot_user_id
  FROM public.profiles
  WHERE email LIKE 'bot%@sistema.local'
  ORDER BY RANDOM()
  LIMIT 1;
  
  -- Se não encontrar nenhum bot, criar um novo
  IF bot_user_id IS NULL THEN
    bot_user_id := gen_random_uuid();
    
    INSERT INTO public.profiles (
      user_id, 
      full_name, 
      email, 
      bids_balance,
      is_admin
    ) VALUES (
      bot_user_id,
      'Sistema Bot',
      'bot@sistema.local',
      999999999,
      false
    );
  END IF;
  
  RETURN bot_user_id;
END;
$function$

-- Criar função para obter bot aleatório (melhor performance)
CREATE OR REPLACE FUNCTION public.get_random_bot_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  bot_user_id uuid;
BEGIN
  SELECT user_id INTO bot_user_id
  FROM public.profiles
  WHERE email LIKE 'bot%@sistema.local'
  ORDER BY RANDOM()
  LIMIT 1;
  
  -- Se não encontrar, usar ensure_bot_user como fallback
  IF bot_user_id IS NULL THEN
    bot_user_id := public.ensure_bot_user();
  END IF;
  
  RETURN bot_user_id;
END;
$function$

-- 2. Criar o cron job para sync-timers-and-protection
-- Verificar se já existe o cron job antes de criar
SELECT cron.unschedule('sync-timers-and-protection') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-timers-and-protection'
);

-- Criar o cron job rodando a cada 5 segundos
SELECT cron.schedule(
  'sync-timers-and-protection',
  '*/5 * * * * *', -- A cada 5 segundos
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) as request_id;
  $$
);