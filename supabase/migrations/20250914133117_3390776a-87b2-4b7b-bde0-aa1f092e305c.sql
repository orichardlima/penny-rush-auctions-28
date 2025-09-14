-- Inserir leilões diversos com produtos reais

-- Apple Watch Ultra
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Apple Watch Ultra 2 - GPS + Cellular 49mm',
  'O Apple Watch mais resistente e avançado já criado. Com tela Retina Always-On, GPS preciso, bateria de até 36 horas e resistência extrema para aventuras. Inclui pulseira Alpine Loop laranja.',
  '/src/assets/apple-watch-ultra.jpg',
  1.00,
  1.00,
  6500.00,
  13000.00,
  'waiting',
  NOW() + INTERVAL '5 minutes'
);

-- iPhone 15 Pro
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'iPhone 15 Pro 256GB - Titânio Natural',
  'iPhone 15 Pro com chip A17 Pro revolucionário, câmera principal de 48MP, zoom óptico 3x, design em titânio aeroespacial e botão Ação customizável. A inovação na palma da sua mão.',
  '/src/assets/iphone-15-pro.jpg',
  1.00,
  1.00,
  8500.00,
  17000.00,
  'waiting',
  NOW() + INTERVAL '10 minutes'
);

-- MacBook Air M2
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'MacBook Air 13" M2 - 512GB SSD - Meia-noite',
  'MacBook Air com chip M2 de 8 núcleos, 16GB de RAM unified, SSD de 512GB, tela Liquid Retina de 13.6", até 18h de bateria. Design ultrafino e potente para trabalho e criação.',
  '/src/assets/macbook-air-m2.jpg',
  1.00,
  1.00,
  9200.00,
  18400.00,
  'waiting',
  NOW() + INTERVAL '15 minutes'
);

-- PlayStation 5
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Console Sony PlayStation 5 - Edição Padrão',
  'PlayStation 5 com SSD ultra-rápido, ray tracing em hardware, áudio 3D Tempest, controle DualSense com feedback háptico. Inclui 1 controle e todos os cabos. Experiência next-gen garantida.',
  '/src/assets/playstation-5.jpg',
  1.00,
  1.00,
  4200.00,
  8400.00,
  'waiting',
  NOW() + INTERVAL '20 minutes'
);

-- Samsung Galaxy S24
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Samsung Galaxy S24 Ultra 256GB - Preto',
  'Galaxy S24 Ultra com S Pen integrada, câmera de 200MP com zoom 100x, tela Dynamic AMOLED 6.8", processador Snapdragon 8 Gen 3, 12GB RAM. O smartphone mais avançado da Samsung.',
  '/src/assets/samsung-s24.jpg',
  1.00,
  1.00,
  4800.00,
  9600.00,
  'waiting',
  NOW() + INTERVAL '25 minutes'
);

-- Smart TV 55"
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Smart TV 55" 4K UHD - Tela QLED HDR10+',
  'Smart TV 55 polegadas com resolução 4K UHD, tecnologia QLED, HDR10+, sistema operacional Android TV, Wi-Fi integrado, 3 HDMI, 2 USB. Entretenimento em alta definição para toda família.',
  '/src/assets/smart-tv-55.jpg',
  1.00,
  1.00,
  2800.00,
  5600.00,
  'waiting',
  NOW() + INTERVAL '30 minutes'
);

-- AirPods Pro 3
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Apple AirPods Pro 3ª Geração - Cancelamento Ativo de Ruído',
  'AirPods Pro com chip H2, cancelamento ativo de ruído 2x superior, áudio adaptativo, modo transparência, controle por toque, estojo MagSafe. Até 6h de bateria + 30h com estojo.',
  '/src/assets/airpods-pro-3.jpg',
  1.00,
  1.00,
  2200.00,
  4400.00,
  'waiting',
  NOW() + INTERVAL '35 minutes'
);

-- Nintendo Switch OLED
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Nintendo Switch OLED - Neon Azul e Vermelho',
  'Nintendo Switch modelo OLED com tela de 7" vibrante, 64GB, base com porta LAN, Joy-Con neon azul/vermelho, áudio aprimorado. Jogue em casa ou em qualquer lugar.',
  '/src/assets/nintendo-switch-oled.jpg',
  1.00,
  1.00,
  2400.00,
  4800.00,
  'waiting',
  NOW() + INTERVAL '40 minutes'
);

-- Xbox Series X
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Console Microsoft Xbox Series X 1TB',
  'Xbox Series X com 1TB SSD, 4K nativo até 120fps, ray tracing, Quick Resume, retrocompatibilidade. O console Xbox mais poderoso de todos os tempos. Inclui 1 controle wireless.',
  '/src/assets/xbox-series-x.jpg',
  1.00,
  1.00,
  4000.00,
  8000.00,
  'waiting',
  NOW() + INTERVAL '45 minutes'
);

-- Notebook ASUS ROG
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Notebook Gamer ASUS ROG Strix G15 - RTX 4060',
  'Notebook gamer ASUS ROG com AMD Ryzen 7, RTX 4060, 16GB DDR5, SSD 512GB, tela 15.6" 144Hz, teclado RGB, sistema de resfriamento avançado. Performance extrema para games e trabalho.',
  '/src/assets/notebook-asus-rog.jpg',
  1.00,
  1.00,
  6800.00,
  13600.00,
  'waiting',
  NOW() + INTERVAL '50 minutes'
);

-- Canon EOS R8
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Câmera Canon EOS R8 + Lente RF 24-50mm',
  'Câmera mirrorless full-frame Canon EOS R8 com sensor de 24.2MP, vídeo 4K60p, estabilização de imagem, foco dual pixel, Wi-Fi/Bluetooth. Inclui lente RF 24-50mm IS STM.',
  '/src/assets/canon-eos-r8.jpg',
  1.00,
  1.00,
  7200.00,
  14400.00,
  'waiting',
  NOW() + INTERVAL '55 minutes'
);

-- DJI Mini 4 Pro
INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  market_value,
  revenue_target,
  status,
  starts_at
) VALUES (
  'Drone DJI Mini 4 Pro - Câmera 4K HDR',
  'Drone DJI Mini 4 Pro com câmera 4K/60fps HDR, gimbal 3 eixos, sensores omnidirecionais, até 34min de voo, controle inteligente. Compacto, potente e fácil de usar.',
  '/src/assets/dji-mini-4-pro.jpg',
  1.00,
  1.00,
  5400.00,
  10800.00,
  'waiting',
  NOW() + INTERVAL '60 minutes'
);