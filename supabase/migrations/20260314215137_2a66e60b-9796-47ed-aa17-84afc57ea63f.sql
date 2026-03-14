
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('affiliate_repurchase_enabled', 'true', 'boolean', 'Habilita comissões de recompra para afiliados'),
  ('affiliate_repurchase_commission_rate', '10', 'number', 'Taxa de comissão (%) para recompras de afiliados')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
