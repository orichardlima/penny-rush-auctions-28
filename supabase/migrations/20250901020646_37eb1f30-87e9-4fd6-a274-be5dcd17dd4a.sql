-- Adicionar campo external_reference à tabela bid_purchases para tracking do Mercado Pago
ALTER TABLE public.bid_purchases 
ADD COLUMN external_reference TEXT;

-- Criar índice para performance
CREATE INDEX idx_bid_purchases_external_reference 
ON public.bid_purchases(external_reference);