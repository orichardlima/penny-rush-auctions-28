-- Adicionar campos para controlar o timer dos leilões
ALTER TABLE public.auctions 
ADD COLUMN ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN time_remaining INTEGER DEFAULT 15,
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Atualizar leilões existentes para ter um tempo de finalização
UPDATE public.auctions 
SET ends_at = NOW() + INTERVAL '15 seconds',
    time_remaining = 15,
    is_active = true
WHERE status = 'active';

-- Criar função para calcular tempo restante
CREATE OR REPLACE FUNCTION calculate_time_remaining(auction_ends_at TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
BEGIN
  IF auction_ends_at IS NULL THEN
    RETURN 0;
  END IF;
  
  RETURN GREATEST(0, EXTRACT(EPOCH FROM (auction_ends_at - NOW()))::INTEGER);
END;
$$ LANGUAGE plpgsql;