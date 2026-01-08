-- Inserir configuração do dia de pagamento semanal
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'partner_weekly_payment_day',
  '5',
  'number',
  'Dia da semana para processamento de pagamentos (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb)'
)
ON CONFLICT (setting_key) DO NOTHING;