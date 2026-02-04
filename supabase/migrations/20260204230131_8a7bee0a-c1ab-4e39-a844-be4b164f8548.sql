-- Insert banner configuration settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('launch_banner_enabled', 'true', 'boolean', 'Ativar/desativar banner de lançamento na home'),
  ('launch_banner_title', '🎉 LANÇAMENTO OFICIAL!', 'string', 'Título principal do banner de lançamento'),
  ('launch_banner_subtitle', 'A plataforma Show de Lances está no ar!', 'string', 'Subtítulo do banner de lançamento'),
  ('launch_banner_highlight', 'Cada lance custa apenas R$ 1!', 'string', 'Texto de destaque do banner (desktop)'),
  ('launch_banner_cta1_text', 'Ver Leilões', 'string', 'Texto do botão primário do banner'),
  ('launch_banner_cta1_link', '/#leiloes', 'string', 'Link do botão primário do banner'),
  ('launch_banner_cta2_text', 'Comprar Lances', 'string', 'Texto do botão secundário do banner'),
  ('launch_banner_cta2_link', '/pacotes', 'string', 'Link do botão secundário do banner'),
  ('launch_banner_mobile_cta_text', 'Participar', 'string', 'Texto do botão mobile do banner'),
  ('launch_banner_expires_at', '', 'string', 'Data/hora de expiração do banner (formato ISO)')
ON CONFLICT (setting_key) DO NOTHING;