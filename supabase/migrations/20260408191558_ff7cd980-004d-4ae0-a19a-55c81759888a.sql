
-- Insert withdrawal configuration settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('withdrawal_allowed_days', '1,2,3,4,5', 'string', 'Dias da semana permitidos para saque (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb)'),
  ('withdrawal_start_hour', '8', 'number', 'Hora de início da janela de saque (0-23, horário de Brasília)'),
  ('withdrawal_end_hour', '18', 'number', 'Hora de fim da janela de saque (0-23, horário de Brasília)'),
  ('withdrawal_fee_percentage', '0', 'number', 'Taxa percentual descontada do valor de saque (%)'),
  ('partner_min_withdrawal', '50', 'number', 'Valor mínimo para saque de parceiros (R$)')
ON CONFLICT (setting_key) DO NOTHING;

-- Add fee columns to partner_withdrawals
ALTER TABLE partner_withdrawals
  ADD COLUMN IF NOT EXISTS fee_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric;

-- Add fee columns to affiliate_withdrawals
ALTER TABLE affiliate_withdrawals
  ADD COLUMN IF NOT EXISTS fee_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric;
