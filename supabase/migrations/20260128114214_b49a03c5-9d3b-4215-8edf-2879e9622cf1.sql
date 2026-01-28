-- Tabela para créditos manuais de parceiros
CREATE TABLE public.partner_manual_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id uuid NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  credit_type text NOT NULL DEFAULT 'bonus',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  
  CONSTRAINT partner_manual_credits_contract_fk 
    FOREIGN KEY (partner_contract_id) 
    REFERENCES partner_contracts(id) ON DELETE CASCADE
);

-- Índice para busca por contrato
CREATE INDEX idx_partner_manual_credits_contract 
  ON partner_manual_credits(partner_contract_id);

-- RLS
ALTER TABLE partner_manual_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage manual credits"
  ON partner_manual_credits FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view their own credits"
  ON partner_manual_credits FOR SELECT
  USING (partner_contract_id IN (
    SELECT id FROM partner_contracts WHERE user_id = auth.uid()
  ));