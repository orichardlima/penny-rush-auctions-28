
-- 1) Soft-delete templates fracos (< R$ 800), preservando Mi Band 10 e JBL 510BT
UPDATE product_templates 
SET is_active = false, updated_at = now()
WHERE market_value < 800 
  AND is_active = true
  AND title NOT ILIKE '%Mi Band 10%'
  AND title NOT ILIKE '%JBL Tune 510BT%';

-- 2) Inserir 30 novos templates premium (R$ 800 – R$ 3.000)
INSERT INTO product_templates (title, description, category, market_value, starting_price, bid_increment, bid_cost, revenue_target, tier, is_active, min_hours_between_appearances, image_source)
VALUES
-- Eletrônicos / Smartphones / Games (15)
('Smart TV 50" 4K UHD', 'Smart TV 50 polegadas 4K com HDR, Wi-Fi e apps de streaming', 'eletronicos', 2299, 1.00, 0.01, 1.00, 2299, 'premium', true, 24, 'ai_generated'),
('Smart TV 43" 4K UHD', 'Smart TV 43 polegadas 4K com Wi-Fi integrado e Netflix', 'eletronicos', 1799, 1.00, 0.01, 1.00, 1799, 'premium', true, 24, 'ai_generated'),
('Notebook 15" Intel i5 8GB SSD', 'Notebook 15.6" Intel Core i5, 8GB RAM, SSD 256GB, ideal para trabalho', 'informatica', 2799, 1.00, 0.01, 1.00, 2799, 'premium', true, 24, 'ai_generated'),
('iPhone 12 64GB Seminovo', 'iPhone 12 64GB seminovo em perfeito estado, garantia de 90 dias', 'smartphones', 2499, 1.00, 0.01, 1.00, 2499, 'premium', true, 24, 'ai_generated'),
('Samsung Galaxy A55 5G 256GB', 'Smartphone Galaxy A55 5G com 8GB RAM, 256GB e câmera tripla 50MP', 'smartphones', 2199, 1.00, 0.01, 1.00, 2199, 'premium', true, 24, 'ai_generated'),
('AirPods Pro 2ª Geração', 'Fones AirPods Pro 2 com cancelamento de ruído ativo e estojo MagSafe', 'eletronicos', 1899, 1.00, 0.01, 1.00, 1899, 'premium', true, 24, 'ai_generated'),
('JBL Charge 5 Bluetooth', 'Caixa de som JBL Charge 5 portátil à prova d''água com 20h de bateria', 'eletronicos', 999, 1.00, 0.01, 1.00, 999, 'premium', true, 24, 'ai_generated'),
('Apple Watch SE 2ª Geração', 'Apple Watch SE 2 GPS 40mm com monitor cardíaco e GPS integrado', 'eletronicos', 2199, 1.00, 0.01, 1.00, 2199, 'premium', true, 24, 'ai_generated'),
('Galaxy Watch 6 44mm', 'Smartwatch Samsung Galaxy Watch 6 com monitor de saúde avançado', 'eletronicos', 1499, 1.00, 0.01, 1.00, 1499, 'premium', true, 24, 'ai_generated'),
('iPad 9ª Geração 64GB Wi-Fi', 'iPad Apple 9ª geração tela 10.2", 64GB, ideal para estudo e trabalho', 'eletronicos', 2799, 1.00, 0.01, 1.00, 2799, 'premium', true, 24, 'ai_generated'),
('Tablet Galaxy Tab A9+ 64GB', 'Tablet Samsung Galaxy Tab A9+ tela 11" 64GB com som Dolby Atmos', 'eletronicos', 1299, 1.00, 0.01, 1.00, 1299, 'premium', true, 24, 'ai_generated'),
('PlayStation 4 Slim 1TB', 'Console PlayStation 4 Slim 1TB com 2 controles e jogos inclusos', 'games', 1799, 1.00, 0.01, 1.00, 1799, 'premium', true, 24, 'ai_generated'),
('Nintendo Switch Lite', 'Console Nintendo Switch Lite portátil compacto, várias cores', 'games', 1499, 1.00, 0.01, 1.00, 1499, 'premium', true, 24, 'ai_generated'),
('Xbox Series S 512GB SSD', 'Console Xbox Series S 512GB SSD all-digital, 1440p e 120fps', 'games', 2299, 1.00, 0.01, 1.00, 2299, 'premium', true, 24, 'ai_generated'),
('Monitor Gamer 24" 144Hz', 'Monitor gamer 24 polegadas Full HD 144Hz com 1ms de resposta', 'informatica', 999, 1.00, 0.01, 1.00, 999, 'premium', true, 24, 'ai_generated'),

-- Casa / Eletrodomésticos (10)
('Air Fryer Forno 12L', 'Fritadeira sem óleo Air Fryer Oven 12 litros multifunção', 'casa', 899, 1.00, 0.01, 1.00, 899, 'premium', true, 24, 'ai_generated'),
('Robô Aspirador Wi-Fi', 'Robô aspirador inteligente com mapeamento, controle por app e alta sucção', 'casa', 1299, 1.00, 0.01, 1.00, 1299, 'premium', true, 24, 'ai_generated'),
('Geladeira Frost Free 300L', 'Geladeira duplex Frost Free 300 litros com freezer e gavetão', 'casa', 2499, 1.00, 0.01, 1.00, 2499, 'premium', true, 24, 'ai_generated'),
('Micro-ondas 32L Inox', 'Micro-ondas 32 litros inox com 10 níveis de potência e grill', 'casa', 899, 1.00, 0.01, 1.00, 899, 'premium', true, 24, 'ai_generated'),
('Máquina Lava e Seca 11kg', 'Lava e seca 11kg com 12 programas, função vapor e Eco Bubble', 'casa', 2999, 1.00, 0.01, 1.00, 2999, 'premium', true, 24, 'ai_generated'),
('Fogão 5 Bocas Inox', 'Fogão 5 bocas piso inox com forno autolimpante e acendimento automático', 'casa', 1499, 1.00, 0.01, 1.00, 1499, 'premium', true, 24, 'ai_generated'),
('Cafeteira Espresso Automática', 'Cafeteira espresso automática com moedor integrado e cappuccinatore', 'casa', 1199, 1.00, 0.01, 1.00, 1199, 'premium', true, 24, 'ai_generated'),
('Aspirador Vertical Sem Fio', 'Aspirador vertical sem fio 2 em 1 com bateria de longa duração', 'casa', 999, 1.00, 0.01, 1.00, 999, 'premium', true, 24, 'ai_generated'),
('Purificador de Água Eletrônico', 'Purificador de água eletrônico com filtro tripla ação e refrigeração', 'casa', 899, 1.00, 0.01, 1.00, 899, 'premium', true, 24, 'ai_generated'),
('Cooktop Indução 4 Bocas', 'Cooktop por indução 4 bocas com timer e bloqueio de segurança', 'casa', 1799, 1.00, 0.01, 1.00, 1799, 'premium', true, 24, 'ai_generated'),

-- Mobilidade / Outros (5)
('Patinete Elétrico 350W', 'Patinete elétrico 350W dobrável com autonomia de 25km e velocidade 25km/h', 'geral', 1999, 1.00, 0.01, 1.00, 1999, 'premium', true, 24, 'ai_generated'),
('Bicicleta Elétrica Dobrável', 'Bicicleta elétrica dobrável aro 20 com motor 350W e bateria de lítio', 'geral', 2799, 1.00, 0.01, 1.00, 2799, 'premium', true, 24, 'ai_generated'),
('Drone 4K com GPS', 'Drone profissional 4K com GPS, retorno automático e 30min de voo', 'eletronicos', 1499, 1.00, 0.01, 1.00, 1499, 'premium', true, 24, 'ai_generated'),
('Câmera DSLR Canon Kit', 'Câmera DSLR Canon EOS Rebel kit com lente 18-55mm e bolsa', 'eletronicos', 2799, 1.00, 0.01, 1.00, 2799, 'premium', true, 24, 'ai_generated'),
('Smartwatch Garmin GPS', 'Smartwatch Garmin com GPS, monitor cardíaco e mais de 25 modos esportivos', 'eletronicos', 1299, 1.00, 0.01, 1.00, 1299, 'premium', true, 24, 'ai_generated');
