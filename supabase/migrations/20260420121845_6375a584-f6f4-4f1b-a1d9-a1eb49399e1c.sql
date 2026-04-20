INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'auto_replenish_default_cooldown_hours',
  '4',
  'Intervalo mínimo (em horas) entre aparições do mesmo título no auto-replenish quando o template não define min_hours_between_appearances'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description;