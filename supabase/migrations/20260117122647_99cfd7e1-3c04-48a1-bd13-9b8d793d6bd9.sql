-- Add partner daily closing time setting
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'partner_daily_closing_time',
  '18',
  'number',
  'Horário de fechamento do dia para visibilidade de receita dos parceiros (0-23). Após este horário, os valores do dia atual ficam visíveis.'
)
ON CONFLICT (setting_key) DO NOTHING;