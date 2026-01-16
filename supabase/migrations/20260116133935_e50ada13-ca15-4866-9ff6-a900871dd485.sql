-- Add max weekly percentage setting
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'partner_max_weekly_percentage',
  '10',
  'number',
  'Limite máximo da soma de porcentagens diárias por semana para repasse de parceiros'
)
ON CONFLICT (setting_key) DO NOTHING;