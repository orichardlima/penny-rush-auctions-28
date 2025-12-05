-- Configurações de promoção de multiplicador de lances
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description) VALUES
('promo_multiplier_enabled', 'false', 'boolean', 'Ativar promoção de multiplicador de lances'),
('promo_multiplier_value', '2', 'number', 'Valor do multiplicador (ex: 2 = dobro, 1.5 = 50% extra)'),
('promo_multiplier_label', 'LANCES EM DOBRO 🔥', 'string', 'Texto do banner promocional'),
('promo_multiplier_expires_at', '', 'string', 'Data/hora de expiração da promoção (ISO 8601)')
ON CONFLICT (setting_key) DO NOTHING;