-- Corrigir inconsistências nos pacotes de lances
UPDATE public.bid_packages 
SET features = ARRAY['15 lances', 'Suporte básico', 'Válido por 30 dias']
WHERE id = '879c4b1a-7250-43c3-82a5-8d5807733ffe' AND name = 'Pacote Iniciante';

-- Verificar e corrigir outros pacotes para garantir consistência
UPDATE public.bid_packages 
SET features = ARRAY['60 lances', 'Suporte prioritário', 'Válido por 60 dias', 'Bônus de 10 lances']
WHERE id = '6aa07700-9fa8-4c1d-a565-cc3694cd5d12' AND name = 'Pacote Popular';

UPDATE public.bid_packages 
SET features = ARRAY['120 lances', 'Suporte VIP', 'Válido por 90 dias', 'Bônus de 50 lances', 'Acesso antecipado']
WHERE id = '743e1cff-d4e3-40b3-8b55-647310976c9f' AND name = 'Pacote Premium';