-- Create product_templates table for reusable product definitions
CREATE TABLE public.product_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  market_value NUMERIC DEFAULT 0.00,
  revenue_target NUMERIC DEFAULT 0.00,
  starting_price NUMERIC DEFAULT 0.01,
  bid_increment NUMERIC DEFAULT 0.01,
  bid_cost NUMERIC DEFAULT 1.00,
  category TEXT DEFAULT 'geral',
  is_active BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('America/Sao_Paulo', now())
);

-- Enable RLS
ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage product templates
CREATE POLICY "Admins can manage product templates"
ON public.product_templates
FOR ALL
USING (is_admin_user(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_product_templates_updated_at
BEFORE UPDATE ON public.product_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for category filtering
CREATE INDEX idx_product_templates_category ON public.product_templates(category);
CREATE INDEX idx_product_templates_is_active ON public.product_templates(is_active);