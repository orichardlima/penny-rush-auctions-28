-- Add partner cutoff and payment day settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('partner_cutoff_day', '10', 'number', 'Dia de corte para elegibilidade de repasse no mesmo mês'),
  ('partner_payment_day', '20', 'number', 'Dia do pagamento mensal de repasses')
ON CONFLICT (setting_key) DO NOTHING;