-- Tabela de materiais promocionais
CREATE TABLE public.ad_center_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  target_date date,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at timestamptz DEFAULT timezone('America/Sao_Paulo', now())
);

-- Tabela de confirmacoes diarias
CREATE TABLE public.ad_center_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id uuid NOT NULL REFERENCES public.partner_contracts(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.ad_center_materials(id),
  completion_date date NOT NULL,
  social_network text NOT NULL,
  confirmed_at timestamptz DEFAULT timezone('America/Sao_Paulo', now()),
  UNIQUE(partner_contract_id, completion_date)
);

-- RLS para ad_center_materials
ALTER TABLE public.ad_center_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage materials" ON public.ad_center_materials
  FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "Partners can view active materials" ON public.ad_center_materials
  FOR SELECT USING (is_active = true);

-- RLS para ad_center_completions
ALTER TABLE public.ad_center_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own completions" ON public.ad_center_completions
  FOR SELECT USING (
    partner_contract_id IN (
      SELECT id FROM public.partner_contracts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Partners can insert own completions" ON public.ad_center_completions
  FOR INSERT WITH CHECK (
    partner_contract_id IN (
      SELECT id FROM public.partner_contracts 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Admins can manage completions" ON public.ad_center_completions
  FOR ALL USING (is_admin_user(auth.uid()));

-- Indices para performance
CREATE INDEX idx_completions_contract_date 
  ON public.ad_center_completions(partner_contract_id, completion_date);
CREATE INDEX idx_materials_target_date 
  ON public.ad_center_materials(target_date) WHERE is_active = true;