INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES ('withdrawal_zero_fee_last_monday', 'false', 'boolean', 'Isenta a taxa de saque nas solicitacoes feitas na ultima segunda-feira do mes')
ON CONFLICT (setting_key) DO NOTHING;