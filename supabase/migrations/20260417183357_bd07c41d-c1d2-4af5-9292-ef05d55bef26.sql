-- Tabela de materiais exclusivos do programa de afiliados (separada de ad_center_materials que é de parceiros)
CREATE TABLE public.affiliate_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  copy_text TEXT,
  material_type TEXT NOT NULL DEFAULT 'image' CHECK (material_type IN ('image', 'video', 'copy', 'banner', 'story')),
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'managers', 'influencers')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

ALTER TABLE public.affiliate_materials ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam tudo
CREATE POLICY "Admins manage affiliate materials"
ON public.affiliate_materials
FOR ALL
USING (is_admin_user(auth.uid()));

-- Afiliados ativos visualizam materiais ativos respeitando target_audience
CREATE POLICY "Active affiliates view active materials"
ON public.affiliate_materials
FOR SELECT
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM affiliates a
    WHERE a.user_id = auth.uid()
      AND a.status = 'active'
      AND (
        affiliate_materials.target_audience = 'all'
        OR (affiliate_materials.target_audience = 'managers' AND a.role = 'manager')
        OR (affiliate_materials.target_audience = 'influencers' AND a.role = 'influencer')
      )
  )
);

-- Trigger updated_at
CREATE TRIGGER update_affiliate_materials_updated_at
BEFORE UPDATE ON public.affiliate_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index para listagem ordenada
CREATE INDEX idx_affiliate_materials_active_sort ON public.affiliate_materials(is_active, sort_order DESC, created_at DESC);