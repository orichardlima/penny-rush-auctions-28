-- Adicionar campo para definir quando o leilão fica disponível
ALTER TABLE public.auctions 
ADD COLUMN starts_at TIMESTAMP WITH TIME ZONE DEFAULT now();