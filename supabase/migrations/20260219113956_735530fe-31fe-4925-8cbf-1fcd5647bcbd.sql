
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('auto_replenish_duration_min_hours', '1', 'number', 'Duração mínima dos leilões automáticos (horas)'),
  ('auto_replenish_duration_max_hours', '5', 'number', 'Duração máxima dos leilões automáticos (horas)')
ON CONFLICT (setting_key) DO NOTHING;
