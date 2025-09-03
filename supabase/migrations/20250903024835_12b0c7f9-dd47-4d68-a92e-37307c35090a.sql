-- Update bid packages with correct feature calculations
-- Premium Package: R$ 100 = 100 base + 40 bonus = 140 total
UPDATE public.bid_packages 
SET features = ARRAY['100 lances base + 40 bônus', 'Melhor custo-benefício']
WHERE name = 'Premium' AND price = 100;

-- Starter Package: R$ 50 = 50 base + 20 bonus = 70 total  
UPDATE public.bid_packages 
SET features = ARRAY['50 lances base + 20 bônus', 'Perfeito para começar']
WHERE name = 'Starter' AND price = 50;

-- VIP Package: R$ 200 = 200 base + 100 bonus = 300 total
UPDATE public.bid_packages 
SET features = ARRAY['200 lances base + 100 bônus', 'Máximo valor', 'Pacote mais popular']
WHERE name = 'VIP' AND price = 200;