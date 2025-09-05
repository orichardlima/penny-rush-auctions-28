-- Zerar o revenue_target dos leilões ativos para desativar a proteção de receita
UPDATE public.auctions 
SET revenue_target = 0.00 
WHERE status = 'active' AND revenue_target > 0;