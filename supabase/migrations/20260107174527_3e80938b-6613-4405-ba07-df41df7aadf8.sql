-- FASE 2: Adicionar campos de indicação na tabela de contratos
ALTER TABLE partner_contracts 
ADD COLUMN IF NOT EXISTS referred_by_user_id UUID,
ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Gerar código de indicação para contratos existentes
UPDATE partner_contracts 
SET referral_code = UPPER(SUBSTRING(id::TEXT, 1, 8))
WHERE referral_code IS NULL;

-- Criar índice único para código de indicação (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_contracts_referral_code ON partner_contracts(referral_code);

-- Tabela de bônus de indicação de parceiros
CREATE TABLE IF NOT EXISTS partner_referral_bonuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_contract_id UUID NOT NULL REFERENCES partner_contracts(id) ON DELETE CASCADE,
  referred_contract_id UUID NOT NULL REFERENCES partner_contracts(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL,
  aporte_value NUMERIC NOT NULL,
  bonus_percentage NUMERIC NOT NULL DEFAULT 10,
  bonus_value NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  available_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  
  UNIQUE(referred_contract_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_referral_bonuses_referrer ON partner_referral_bonuses(referrer_contract_id);

ALTER TABLE partner_referral_bonuses ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partner_referral_bonuses' AND policyname = 'Users can view own partner referral bonuses') THEN
    CREATE POLICY "Users can view own partner referral bonuses"
    ON partner_referral_bonuses FOR SELECT
    USING (
      referrer_contract_id IN (
        SELECT id FROM partner_contracts WHERE user_id = auth.uid()
      )
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partner_referral_bonuses' AND policyname = 'Admins can manage partner referral bonuses') THEN
    CREATE POLICY "Admins can manage partner referral bonuses"
    ON partner_referral_bonuses FOR ALL
    USING (is_admin_user(auth.uid()));
  END IF;
END $$;

-- FASE 3: Tabela de solicitações de encerramento antecipado
CREATE TABLE IF NOT EXISTS partner_early_terminations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_contract_id UUID NOT NULL REFERENCES partner_contracts(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  status TEXT NOT NULL DEFAULT 'PENDING',
  liquidation_type TEXT NOT NULL,
  
  aporte_original NUMERIC NOT NULL,
  total_received NUMERIC NOT NULL,
  remaining_cap NUMERIC NOT NULL,
  
  discount_percentage NUMERIC NOT NULL DEFAULT 30,
  proposed_value NUMERIC NOT NULL,
  final_value NUMERIC,
  
  credits_amount NUMERIC,
  bids_amount INTEGER,
  
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

CREATE INDEX IF NOT EXISTS idx_partner_early_terminations_contract ON partner_early_terminations(partner_contract_id);
CREATE INDEX IF NOT EXISTS idx_partner_early_terminations_status ON partner_early_terminations(status);

ALTER TABLE partner_early_terminations ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partner_early_terminations' AND policyname = 'Users can view own terminations') THEN
    CREATE POLICY "Users can view own terminations"
    ON partner_early_terminations FOR SELECT
    USING (
      partner_contract_id IN (
        SELECT id FROM partner_contracts WHERE user_id = auth.uid()
      )
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partner_early_terminations' AND policyname = 'Users can request termination') THEN
    CREATE POLICY "Users can request termination"
    ON partner_early_terminations FOR INSERT
    WITH CHECK (
      partner_contract_id IN (
        SELECT id FROM partner_contracts WHERE user_id = auth.uid() AND status = 'ACTIVE'
      )
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partner_early_terminations' AND policyname = 'Admins can manage terminations') THEN
    CREATE POLICY "Admins can manage terminations"
    ON partner_early_terminations FOR ALL
    USING (is_admin_user(auth.uid()));
  END IF;
END $$;