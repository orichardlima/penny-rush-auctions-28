-- 1. Inserir bots fixos na tabela profiles se não existirem
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