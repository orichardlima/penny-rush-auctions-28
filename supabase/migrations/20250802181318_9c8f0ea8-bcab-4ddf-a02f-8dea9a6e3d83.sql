-- Remove trigger duplicado que causa incremento duplo do preço
DROP TRIGGER IF EXISTS trigger_update_auction_stats ON public.bids;

-- Manter apenas o trigger principal
-- (o update_auction_stats_trigger já existe e está funcionando)