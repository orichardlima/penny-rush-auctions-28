-- Desativar completamente o sistema de proteção automática
-- Remove TODOS os cron jobs para parar os lances automáticos

DELETE FROM cron.job;

-- Para o leilão atual, zerar o revenue_target para parar a proteção
UPDATE public.auctions 
SET revenue_target = 0.00 
WHERE status = 'active' AND revenue_target > 0;