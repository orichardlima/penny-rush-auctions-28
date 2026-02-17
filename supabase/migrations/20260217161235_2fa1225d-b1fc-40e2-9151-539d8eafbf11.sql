
-- Insert auto-replenish settings into system_settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('auto_replenish_enabled', 'true', 'boolean', 'Ativar/desativar reposição automática de leilões'),
  ('auto_replenish_min_active', '3', 'number', 'Mínimo de leilões ativos+waiting antes de criar novos'),
  ('auto_replenish_batch_size', '3', 'number', 'Quantos leilões criar de cada vez'),
  ('auto_replenish_interval_minutes', '30', 'number', 'Intervalo em minutos entre os novos leilões'),
  ('auto_replenish_duration_hours', '3', 'number', 'Duração de cada leilão em horas')
ON CONFLICT (setting_key) DO NOTHING;
