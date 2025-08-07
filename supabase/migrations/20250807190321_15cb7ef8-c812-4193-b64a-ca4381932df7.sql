-- Update bot profiles with missing names to have proper Brazilian names
UPDATE public.profiles 
SET full_name = 'Roberto Silva'
WHERE user_id = '6ec255d3-5648-4cba-8afe-fa069be6d577' AND is_bot = true;

-- Add more bot profiles with Brazilian names if needed
INSERT INTO public.profiles (user_id, full_name, email, is_bot)
VALUES 
  (gen_random_uuid(), 'Marina Santos', 'marina.santos.bot@leilao.com', true),
  (gen_random_uuid(), 'Diego Oliveira', 'diego.oliveira.bot@leilao.com', true),
  (gen_random_uuid(), 'Larissa Costa', 'larissa.costa.bot@leilao.com', true),
  (gen_random_uuid(), 'Thiago Alves', 'thiago.alves.bot@leilao.com', true),
  (gen_random_uuid(), 'Natália Ribeiro', 'natalia.ribeiro.bot@leilao.com', true)
ON CONFLICT (user_id) DO NOTHING;