-- Adicionar campo payment_id na tabela bid_purchases se não existir
ALTER TABLE public.bid_purchases 
ADD COLUMN IF NOT EXISTS payment_id TEXT;