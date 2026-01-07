-- =====================================================
-- SISTEMA DE PARCEIROS - Tabelas Principais
-- =====================================================

-- Tabela 1: Contratos de Parceiros
CREATE TABLE public.partner_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  aporte_value DECIMAL NOT NULL,
  monthly_cap DECIMAL NOT NULL,
  total_cap DECIMAL NOT NULL,
  total_received DECIMAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'SUSPENDED')),
  plan_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  closed_at TIMESTAMPTZ,
  closed_reason TEXT
);

-- Índice único para garantir apenas 1 contrato ativo por usuário
CREATE UNIQUE INDEX idx_partner_contracts_active_user 
ON public.partner_contracts (user_id) 
WHERE status = 'ACTIVE';

-- Tabela 2: Snapshots de Receita Mensal
CREATE TABLE public.monthly_revenue_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL UNIQUE,
  gross_revenue DECIMAL NOT NULL,
  partner_fund_percentage DECIMAL NOT NULL DEFAULT 20,
  partner_fund_value DECIMAL NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  closed_at TIMESTAMPTZ
);

-- Tabela 3: Repasses aos Parceiros
CREATE TABLE public.partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id UUID NOT NULL REFERENCES public.partner_contracts(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  calculated_amount DECIMAL NOT NULL,
  amount DECIMAL NOT NULL,
  monthly_cap_applied BOOLEAN NOT NULL DEFAULT false,
  total_cap_applied BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  UNIQUE(partner_contract_id, month)
);

-- Tabela 4: Bônus de Indicação (Sistema Separado)
CREATE TABLE public.referral_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  purchase_id UUID,
  package_value DECIMAL NOT NULL,
  bonus_percentage DECIMAL NOT NULL DEFAULT 10,
  bonus_value DECIMAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'BLOCKED', 'AVAILABLE', 'USED')),
  available_at TIMESTAMPTZ,
  blocked_reason TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Tabela 5: Planos de Parceria
CREATE TABLE public.partner_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  aporte_value DECIMAL NOT NULL,
  monthly_cap DECIMAL NOT NULL,
  total_cap DECIMAL NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Inserir planos padrão
INSERT INTO public.partner_plans (name, display_name, aporte_value, monthly_cap, total_cap, sort_order) VALUES
('START', 'Start', 1000, 150, 2000, 1),
('PRO', 'Pro', 5000, 750, 10000, 2),
('ELITE', 'Elite', 15000, 2500, 35000, 3);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.partner_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_revenue_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_plans ENABLE ROW LEVEL SECURITY;

-- Políticas para partner_contracts
CREATE POLICY "Users can view their own contracts"
ON public.partner_contracts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all contracts"
ON public.partner_contracts FOR ALL
USING (is_admin_user(auth.uid()));

-- Políticas para monthly_revenue_snapshots
CREATE POLICY "Anyone can view revenue snapshots"
ON public.monthly_revenue_snapshots FOR SELECT
USING (true);

CREATE POLICY "Admins can manage revenue snapshots"
ON public.monthly_revenue_snapshots FOR ALL
USING (is_admin_user(auth.uid()));

-- Políticas para partner_payouts
CREATE POLICY "Users can view their own payouts"
ON public.partner_payouts FOR SELECT
USING (
  partner_contract_id IN (
    SELECT id FROM public.partner_contracts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all payouts"
ON public.partner_payouts FOR ALL
USING (is_admin_user(auth.uid()));

-- Políticas para referral_bonuses
CREATE POLICY "Users can view their own referral bonuses"
ON public.referral_bonuses FOR SELECT
USING (auth.uid() = referrer_user_id);

CREATE POLICY "Admins can manage all referral bonuses"
ON public.referral_bonuses FOR ALL
USING (is_admin_user(auth.uid()));

-- Políticas para partner_plans
CREATE POLICY "Anyone can view active partner plans"
ON public.partner_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage partner plans"
ON public.partner_plans FOR ALL
USING (is_admin_user(auth.uid()));

-- =====================================================
-- Configurações do Sistema de Parceiros
-- =====================================================

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description) VALUES
('partner_fund_percentage', '20', 'number', 'Percentual do faturamento destinado ao fundo de parceiros'),
('partner_referral_bonus_percentage', '10', 'number', 'Percentual de bônus por indicação'),
('partner_referral_delay_days', '7', 'number', 'Dias para liberação do bônus de indicação'),
('partner_monthly_bonus_limit', '5000', 'number', 'Limite mensal de bônus de indicação por usuário'),
('partner_system_enabled', 'true', 'boolean', 'Sistema de parceiros ativo')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- Trigger para atualizar updated_at
-- =====================================================

CREATE TRIGGER update_partner_contracts_updated_at
BEFORE UPDATE ON public.partner_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_plans_updated_at
BEFORE UPDATE ON public.partner_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Função para fechar contrato automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_and_close_partner_contract()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_received >= NEW.total_cap AND NEW.status = 'ACTIVE' THEN
    NEW.status := 'CLOSED';
    NEW.closed_at := timezone('America/Sao_Paulo', now());
    NEW.closed_reason := 'Teto total atingido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER auto_close_partner_contract
BEFORE UPDATE ON public.partner_contracts
FOR EACH ROW
EXECUTE FUNCTION public.check_and_close_partner_contract();

-- =====================================================
-- Índices para performance
-- =====================================================

CREATE INDEX idx_partner_contracts_user_id ON public.partner_contracts(user_id);
CREATE INDEX idx_partner_contracts_status ON public.partner_contracts(status);
CREATE INDEX idx_partner_payouts_contract ON public.partner_payouts(partner_contract_id);
CREATE INDEX idx_partner_payouts_month ON public.partner_payouts(month);
CREATE INDEX idx_referral_bonuses_referrer ON public.referral_bonuses(referrer_user_id);
CREATE INDEX idx_referral_bonuses_status ON public.referral_bonuses(status);
CREATE INDEX idx_monthly_revenue_snapshots_month ON public.monthly_revenue_snapshots(month);