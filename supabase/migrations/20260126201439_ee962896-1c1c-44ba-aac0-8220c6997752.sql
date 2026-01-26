-- Adicionar campo max_price para encerramento automático por preço
ALTER TABLE auctions 
ADD COLUMN IF NOT EXISTS max_price numeric DEFAULT NULL;

COMMENT ON COLUMN auctions.max_price IS 'Preço máximo para encerramento automático do leilão';