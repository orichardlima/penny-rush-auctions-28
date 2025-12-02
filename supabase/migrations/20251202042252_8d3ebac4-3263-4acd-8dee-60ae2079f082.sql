-- Adicionar configurações globais de afiliados no system_settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('affiliate_default_commission_rate', '10', 'number', 'Taxa de comissão padrão para novos afiliados (%)'),
  ('affiliate_auto_approve', 'false', 'boolean', 'Aprovar novos afiliados automaticamente'),
  ('affiliate_commission_auto_approve', 'false', 'boolean', 'Aprovar comissões automaticamente'),
  ('affiliate_min_withdrawal', '50', 'number', 'Valor mínimo para solicitar saque (R$)'),
  ('affiliate_commission_delay_days', '7', 'number', 'Dias de carência antes de aprovar comissão automaticamente')
ON CONFLICT (setting_key) DO NOTHING;