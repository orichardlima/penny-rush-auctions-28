-- Adicionar campos necessários para o cadastro completo de leilões
ALTER TABLE public.auctions 
ADD COLUMN IF NOT EXISTS market_value INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_target INTEGER DEFAULT 0;

-- Comentários para documentar os novos campos
COMMENT ON COLUMN public.auctions.market_value IS 'Valor do produto no mercado em centavos';
COMMENT ON COLUMN public.auctions.revenue_target IS 'Meta de faturamento em centavos para controle dos bots';