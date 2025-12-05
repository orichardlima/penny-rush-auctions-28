-- Adicionar configuração de modo de cálculo da promoção
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES ('promo_multiplier_mode', 'base', 'string', 'Modo de cálculo da promoção: base (multiplica preço), total (multiplica lances totais), bonus (adiciona bônus extra)')
ON CONFLICT (setting_key) DO NOTHING;