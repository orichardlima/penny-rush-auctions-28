-- Tabela de Afiliados
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'inactive')),
  commission_rate NUMERIC NOT NULL DEFAULT 10.00,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  total_commission_earned NUMERIC NOT NULL DEFAULT 0.00,
  total_commission_paid NUMERIC NOT NULL DEFAULT 0.00,
  commission_balance NUMERIC NOT NULL DEFAULT 0.00,
  pix_key TEXT,
  bank_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- Tabela de Referrals (Cliques)
CREATE TABLE public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  click_source TEXT,
  ip_address TEXT,
  user_agent TEXT,
  converted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Tabela de Comissões
CREATE TABLE public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.bid_purchases(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Tabela de Solicitações de Saque
CREATE TABLE public.affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  payment_details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  rejection_reason TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Índices para performance
CREATE INDEX idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX idx_affiliates_code ON public.affiliates(affiliate_code);
CREATE INDEX idx_affiliates_status ON public.affiliates(status);
CREATE INDEX idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals(affiliate_id);
CREATE INDEX idx_affiliate_referrals_referred_user ON public.affiliate_referrals(referred_user_id);
CREATE INDEX idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions(affiliate_id);
CREATE INDEX idx_affiliate_commissions_purchase_id ON public.affiliate_commissions(purchase_id);
CREATE INDEX idx_affiliate_commissions_status ON public.affiliate_commissions(status);
CREATE INDEX idx_affiliate_withdrawals_affiliate_id ON public.affiliate_withdrawals(affiliate_id);
CREATE INDEX idx_affiliate_withdrawals_status ON public.affiliate_withdrawals(status);

-- RLS Policies

-- Affiliates
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own affiliate account"
  ON public.affiliates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own affiliate account"
  ON public.affiliates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all affiliates"
  ON public.affiliates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Affiliate Referrals
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own referrals"
  ON public.affiliate_referrals FOR SELECT
  TO authenticated
  USING (
    affiliate_id IN (
      SELECT id FROM public.affiliates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert referrals"
  ON public.affiliate_referrals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view all referrals"
  ON public.affiliate_referrals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Affiliate Commissions
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own commissions"
  ON public.affiliate_commissions FOR SELECT
  TO authenticated
  USING (
    affiliate_id IN (
      SELECT id FROM public.affiliates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all commissions"
  ON public.affiliate_commissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Affiliate Withdrawals
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own withdrawals"
  ON public.affiliate_withdrawals FOR SELECT
  TO authenticated
  USING (
    affiliate_id IN (
      SELECT id FROM public.affiliates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Affiliates can request withdrawals"
  ON public.affiliate_withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (
    affiliate_id IN (
      SELECT id FROM public.affiliates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all withdrawals"
  ON public.affiliate_withdrawals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Função para atualizar estatísticas do afiliado
CREATE OR REPLACE FUNCTION public.update_affiliate_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Quando uma comissão é aprovada
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.affiliates
    SET 
      total_commission_earned = total_commission_earned + NEW.commission_amount,
      commission_balance = commission_balance + NEW.commission_amount
    WHERE id = NEW.affiliate_id;
  END IF;
  
  -- Quando uma comissão é cancelada
  IF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
    UPDATE public.affiliates
    SET 
      total_commission_earned = GREATEST(total_commission_earned - NEW.commission_amount, 0),
      commission_balance = GREATEST(commission_balance - NEW.commission_amount, 0)
    WHERE id = NEW.affiliate_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_affiliate_stats_trigger
  AFTER INSERT OR UPDATE OF status ON public.affiliate_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliate_stats();

-- Função para processar saque
CREATE OR REPLACE FUNCTION public.process_affiliate_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Quando um saque é completado
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.affiliates
    SET 
      commission_balance = GREATEST(commission_balance - NEW.amount, 0),
      total_commission_paid = total_commission_paid + NEW.amount
    WHERE id = NEW.affiliate_id;
    
    -- Marcar comissões como pagas
    UPDATE public.affiliate_commissions
    SET 
      status = 'paid',
      paid_at = timezone('America/Sao_Paulo', now())
    WHERE affiliate_id = NEW.affiliate_id
      AND status = 'approved'
      AND commission_amount <= NEW.amount;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER process_affiliate_withdrawal_trigger
  AFTER UPDATE OF status ON public.affiliate_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.process_affiliate_withdrawal();