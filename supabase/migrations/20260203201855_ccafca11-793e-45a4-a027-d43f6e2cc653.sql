-- Adicionar status de pagamento nos contratos de parceiro
ALTER TABLE partner_contracts 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'completed';

ALTER TABLE partner_contracts 
ADD COLUMN IF NOT EXISTS payment_id text;

-- Índice para busca por payment_id no webhook
CREATE INDEX IF NOT EXISTS idx_partner_contracts_payment_id ON partner_contracts(payment_id) WHERE payment_id IS NOT NULL;