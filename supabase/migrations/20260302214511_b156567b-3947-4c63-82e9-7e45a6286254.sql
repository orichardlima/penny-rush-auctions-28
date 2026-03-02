-- Finalizar manualmente os 4 leilões ativos parados

-- PlayStation 5 SLIM (bot como vencedor, conforme aprovado)
UPDATE auctions SET 
  status = 'finished', 
  winner_id = '4a7d1978-dc04-417e-8c71-b7cb0a18ddc2', 
  winner_name = 'Luciane T. - Juazeiro do Norte, CE', 
  finished_at = now() 
WHERE id = 'd163419e-823b-4efe-8062-adb210766fae' AND status = 'active';

-- JBL BOOMBOX 3
UPDATE auctions SET 
  status = 'finished', 
  winner_id = '70c5b3c6-a7b6-4f5c-b5e9-b362f3f50cde', 
  winner_name = 'Luiz C. - Salvador, BA', 
  finished_at = now() 
WHERE id = '9cb99034-3abd-4602-8b8e-6e36e40d94f0' AND status = 'active';

-- iPhone 17 Pro Max
UPDATE auctions SET 
  status = 'finished', 
  winner_id = 'cb85af36-0756-4ae3-9b58-5efc79ee1087', 
  winner_name = 'Adailton M. - Lauro de Freitas, BA', 
  finished_at = now() 
WHERE id = '97e8a90a-f24a-4607-8984-b1080d89c460' AND status = 'active';

-- Fone JBL Tune 510BT
UPDATE auctions SET 
  status = 'finished', 
  winner_id = 'cb85af36-0756-4ae3-9b58-5efc79ee1087', 
  winner_name = 'Adailton M. - Lauro de Freitas, BA', 
  finished_at = now() 
WHERE id = 'fe54a8c2-b4f9-406d-bbe2-26b7be97750e' AND status = 'active';