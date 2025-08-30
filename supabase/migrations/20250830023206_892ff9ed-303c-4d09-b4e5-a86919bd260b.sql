-- Criar leilão teste para verificar funcionamento IMEDIATO
INSERT INTO public.auctions (
  title,
  description,
  starting_price,
  current_price,
  bid_increment,
  bid_cost,
  market_value,
  revenue_target,
  image_url,
  status,
  starts_at,
  time_left
) VALUES (
  'TESTE CORREÇÃO DEFINITIVA - iPhone 15 Pro',
  'Leilão teste para verificar se o sistema está funcionando perfeitamente após correção completa. Este leilão deve ativar automaticamente em 1 minuto.',
  1.00,
  1.00,
  0.01,
  1.00,
  5000.00,
  500.00,
  '/placeholder.svg',
  'waiting',
  timezone('America/Sao_Paulo', now()) + INTERVAL '1 minute',
  15
);