-- Adicionar colunas para modo manual na tabela monthly_revenue_snapshots
ALTER TABLE monthly_revenue_snapshots 
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manual_base TEXT,
ADD COLUMN IF NOT EXISTS manual_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS manual_description TEXT;

-- Comentários para documentação
COMMENT ON COLUMN monthly_revenue_snapshots.is_manual IS 'Indica se o processamento foi feito em modo manual';
COMMENT ON COLUMN monthly_revenue_snapshots.manual_base IS 'Base de cálculo manual: aporte ou monthly_cap';
COMMENT ON COLUMN monthly_revenue_snapshots.manual_percentage IS 'Porcentagem aplicada no modo manual';
COMMENT ON COLUMN monthly_revenue_snapshots.manual_description IS 'Descrição opcional do processamento manual';