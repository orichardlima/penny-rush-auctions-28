-- 1. Adicionar campos no product_templates
ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS min_hours_between_appearances integer NOT NULL DEFAULT 0;

-- 2. Constraint de valores válidos para tier
ALTER TABLE public.product_templates
  DROP CONSTRAINT IF EXISTS product_templates_tier_check;
ALTER TABLE public.product_templates
  ADD CONSTRAINT product_templates_tier_check
  CHECK (tier IN ('standard', 'premium', 'luxury'));

-- 3. Classificar templates existentes pelo market_value
UPDATE public.product_templates
SET 
  tier = CASE
    WHEN market_value >= 2000 THEN 'luxury'
    WHEN market_value >= 500 THEN 'premium'
    ELSE 'standard'
  END,
  min_hours_between_appearances = CASE
    WHEN market_value >= 2000 THEN 72
    WHEN market_value >= 500 THEN 24
    ELSE 0
  END
WHERE tier = 'standard' AND min_hours_between_appearances = 0;

-- 4. Inserir pesos de sorteio em system_settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES
  ('auto_replenish_weight_standard', '10', 'number', 'Peso do tier Standard no sorteio ponderado de templates'),
  ('auto_replenish_weight_premium', '3', 'number', 'Peso do tier Premium no sorteio ponderado de templates'),
  ('auto_replenish_weight_luxury', '1', 'number', 'Peso do tier Luxury no sorteio ponderado de templates')
ON CONFLICT (setting_key) DO NOTHING;