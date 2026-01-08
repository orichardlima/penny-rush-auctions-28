-- Criar tabela de saques de parceiros
CREATE TABLE public.partner_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id UUID NOT NULL REFERENCES partner_contracts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  payment_details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Adicionar campos de pagamento e saldo ao contrato de parceiro
ALTER TABLE public.partner_contracts 
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_key_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_details JSONB,
  ADD COLUMN IF NOT EXISTS available_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC NOT NULL DEFAULT 0;

-- Habilitar RLS
ALTER TABLE public.partner_withdrawals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para partner_withdrawals
CREATE POLICY "Users can request withdrawals for their contracts"
  ON public.partner_withdrawals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_contract_id IN (
      SELECT id FROM partner_contracts 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Users can view their own withdrawals"
  ON public.partner_withdrawals
  FOR SELECT
  TO authenticated
  USING (
    partner_contract_id IN (
      SELECT id FROM partner_contracts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all withdrawals"
  ON public.partner_withdrawals
  FOR ALL
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- Índices para performance
CREATE INDEX idx_partner_withdrawals_contract_id ON public.partner_withdrawals(partner_contract_id);
CREATE INDEX idx_partner_withdrawals_status ON public.partner_withdrawals(status);
CREATE INDEX idx_partner_contracts_pix_key ON public.partner_contracts(pix_key) WHERE pix_key IS NOT NULL;