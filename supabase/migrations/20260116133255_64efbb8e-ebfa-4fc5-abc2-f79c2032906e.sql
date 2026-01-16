-- Create table for daily revenue configuration (percentage-based)
CREATE TABLE public.daily_revenue_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  percentage NUMERIC NOT NULL DEFAULT 0,
  calculation_base TEXT NOT NULL DEFAULT 'aporte',
  description TEXT,
  configured_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT timezone('America/Sao_Paulo', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('America/Sao_Paulo', now()) NOT NULL
);

-- Index for date lookups
CREATE INDEX idx_daily_revenue_config_date ON daily_revenue_config(date);

-- Enable RLS
ALTER TABLE daily_revenue_config ENABLE ROW LEVEL SECURITY;

-- Admin can manage all configs
CREATE POLICY "Admins can manage daily revenue config"
  ON daily_revenue_config FOR ALL
  USING (is_admin_user(auth.uid()));

-- Authenticated users can view configs
CREATE POLICY "Authenticated users can view daily revenue config"
  ON daily_revenue_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_daily_revenue_config_updated_at
  BEFORE UPDATE ON daily_revenue_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();