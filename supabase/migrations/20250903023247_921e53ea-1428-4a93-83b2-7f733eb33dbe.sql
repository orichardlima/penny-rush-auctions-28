-- Povoar bots com cidades/estados brasileiros diversificados
-- Proporção: 60% Sudeste, 20% Sul, 15% Nordeste, 3% Centro-Oeste, 2% Norte

WITH brazilian_cities AS (
  SELECT city, state FROM (VALUES
    -- SUDESTE (60% - região mais populosa)
    ('São Paulo', 'SP'), ('Rio de Janeiro', 'RJ'), ('Belo Horizonte', 'MG'), ('Campinas', 'SP'),
    ('Santos', 'SP'), ('Nova Iguaçu', 'RJ'), ('Uberlândia', 'MG'), ('Ribeirão Preto', 'SP'),
    ('Sorocaba', 'SP'), ('Niterói', 'RJ'), ('Contagem', 'MG'), ('São José do Rio Preto', 'SP'),
    ('Duque de Caxias', 'RJ'), ('Juiz de Fora', 'MG'), ('São Vicente', 'SP'), ('Betim', 'MG'),
    ('Piracicaba', 'SP'), ('São Gonçalo', 'RJ'), ('Montes Claros', 'MG'), ('Vitória', 'ES'),
    ('Campos dos Goytacazes', 'RJ'), ('Uberaba', 'MG'), ('Vila Velha', 'ES'), ('Cariacica', 'ES'),
    ('Serra', 'ES'), ('Cachoeiro de Itapemirim', 'ES'),
    
    -- SUL (20%)
    ('Porto Alegre', 'RS'), ('Curitiba', 'PR'), ('Florianópolis', 'SC'), ('Caxias do Sul', 'RS'),
    ('Londrina', 'PR'), ('Joinville', 'SC'), ('Pelotas', 'RS'), ('Maringá', 'PR'),
    ('Blumenau', 'SC'), ('Canoas', 'RS'), ('Ponta Grossa', 'PR'), ('São José', 'SC'),
    ('Santa Maria', 'RS'), ('Cascavel', 'PR'), ('Criciúma', 'SC'), ('Gravataí', 'RS'),
    ('São José dos Pinhais', 'PR'), ('Chapecó', 'SC'), ('Novo Hamburgo', 'RS'), ('Foz do Iguaçu', 'PR'),
    ('Itajaí', 'SC'),
    
    -- NORDESTE (15%)
    ('Salvador', 'BA'), ('Fortaleza', 'CE'), ('Recife', 'PE'), ('Feira de Santana', 'BA'),
    ('João Pessoa', 'PB'), ('Jaboatão dos Guararapes', 'PE'), ('Caucaia', 'CE'), ('Natal', 'RN'),
    ('Vitória da Conquista', 'BA'), ('Campina Grande', 'PB'), ('Olinda', 'PE'), ('Camaçari', 'BA'),
    ('Juazeiro do Norte', 'CE'), ('Mossoró', 'RN'), ('Caruaru', 'PE'), ('Maracanaú', 'CE'),
    ('Petrolina', 'PE'), ('Juazeiro', 'BA'), ('Sobral', 'CE'), ('Parnamirim', 'RN'),
    ('Itabuna', 'BA'), ('Paulista', 'PE'), ('Santa Rita', 'PB'), ('Crato', 'CE'),
    ('Patos', 'PB'), ('São Gonçalo do Amarante', 'RN'),
    
    -- CENTRO-OESTE (3%)
    ('Brasília', 'DF'), ('Goiânia', 'GO'), ('Cuiabá', 'MT'), ('Campo Grande', 'MS'),
    ('Aparecida de Goiânia', 'GO'), ('Várzea Grande', 'MT'), ('Anápolis', 'GO'), ('Dourados', 'MS'),
    ('Rondonópolis', 'MT'), ('Rio Verde', 'GO'), ('Três Lagoas', 'MS'), ('Luziânia', 'GO'),
    ('Sinop', 'MT'), ('Corumbá', 'MS'), ('Tangará da Serra', 'MT'), ('Gama', 'DF'),
    ('Taguatinga', 'DF'), ('Sobradinho', 'DF'),
    
    -- NORTE (2%)
    ('Manaus', 'AM'), ('Belém', 'PA'), ('Porto Velho', 'RO'), ('Palmas', 'TO'),
    ('Ananindeua', 'PA'), ('Parintins', 'AM'), ('Ji-Paraná', 'RO'), ('Araguaína', 'TO'),
    ('Santarém', 'PA'), ('Itacoatiara', 'AM'), ('Ariquemes', 'RO'), ('Gurupi', 'TO'),
    ('Marabá', 'PA'), ('Manacapuru', 'AM'), ('Vilhena', 'RO'), ('Parauapebas', 'PA')
  ) AS cities(city, state)
),
bot_profiles AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY RANDOM()) as rn
  FROM public.profiles 
  WHERE is_bot = true AND (city IS NULL OR state IS NULL)
),
city_assignments AS (
  SELECT 
    bp.user_id,
    bc.city,
    bc.state
  FROM bot_profiles bp
  CROSS JOIN LATERAL (
    SELECT city, state 
    FROM brazilian_cities 
    ORDER BY RANDOM() 
    LIMIT 1
  ) bc
)
UPDATE public.profiles 
SET 
  city = ca.city,
  state = ca.state,
  updated_at = now()
FROM city_assignments ca
WHERE profiles.user_id = ca.user_id;