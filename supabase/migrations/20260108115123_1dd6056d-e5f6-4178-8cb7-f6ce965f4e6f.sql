-- Renomear tabela monthly_revenue_snapshots para weekly_revenue_snapshots
ALTER TABLE monthly_revenue_snapshots RENAME TO weekly_revenue_snapshots;

-- Renomear coluna month para period_start
ALTER TABLE weekly_revenue_snapshots RENAME COLUMN month TO period_start;

-- Adicionar coluna period_end para representar fim da semana
ALTER TABLE weekly_revenue_snapshots ADD COLUMN period_end DATE;

-- Renomear coluna month em partner_payouts para period_start
ALTER TABLE partner_payouts RENAME COLUMN month TO period_start;

-- Adicionar coluna period_end para representar fim da semana
ALTER TABLE partner_payouts ADD COLUMN period_end DATE;

-- Atualizar dados existentes: para registros antigos (mensais), setar period_end como último dia do mês
UPDATE weekly_revenue_snapshots 
SET period_end = (period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE
WHERE period_end IS NULL;

UPDATE partner_payouts 
SET period_end = (period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE
WHERE period_end IS NULL;