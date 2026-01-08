-- Create partner_upgrades table for audit trail
CREATE TABLE public.partner_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id UUID NOT NULL REFERENCES public.partner_contracts(id) ON DELETE CASCADE,
  
  -- Previous plan data
  previous_plan_name TEXT NOT NULL,
  previous_aporte_value NUMERIC NOT NULL,
  previous_monthly_cap NUMERIC NOT NULL,
  previous_total_cap NUMERIC NOT NULL,
  
  -- New plan data
  new_plan_name TEXT NOT NULL,
  new_aporte_value NUMERIC NOT NULL,
  new_monthly_cap NUMERIC NOT NULL,
  new_total_cap NUMERIC NOT NULL,
  
  -- Values at upgrade time
  total_received_at_upgrade NUMERIC NOT NULL DEFAULT 0,
  difference_paid NUMERIC NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.partner_upgrades ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all upgrades
CREATE POLICY "Admins can manage all upgrades" ON public.partner_upgrades
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- Policy: Users can view their own upgrades
CREATE POLICY "Users can view own upgrades" ON public.partner_upgrades
  FOR SELECT USING (
    partner_contract_id IN (
      SELECT id FROM public.partner_contracts WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own upgrades (for active contracts only)
CREATE POLICY "Users can insert own upgrades" ON public.partner_upgrades
  FOR INSERT WITH CHECK (
    partner_contract_id IN (
      SELECT id FROM public.partner_contracts 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

-- Add index for faster queries
CREATE INDEX idx_partner_upgrades_contract_id ON public.partner_upgrades(partner_contract_id);
CREATE INDEX idx_partner_upgrades_created_at ON public.partner_upgrades(created_at DESC);