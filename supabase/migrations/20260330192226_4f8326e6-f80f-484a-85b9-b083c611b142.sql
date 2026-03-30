INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES ('active_payment_gateway', 'veopag', 'string', 'Gateway de pagamento PIX ativo (veopag ou magenpay)')
ON CONFLICT (setting_key) DO NOTHING;