-- Chaves do Modo de Manutenção
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES
  ('site_maintenance_enabled', 'false', 'boolean', 'Coloca o site em modo de manutenção (tela para visitantes; admins continuam acessando)'),
  ('site_maintenance_message', 'Estamos em manutenção para melhorar sua experiência. Voltamos em breve!', 'string', 'Mensagem exibida na tela de manutenção')
ON CONFLICT (setting_key) DO NOTHING;

-- RPC pública de leitura do status (SECURITY DEFINER: visitantes sem login precisam ver a manutenção)
CREATE OR REPLACE FUNCTION public.get_site_maintenance_status()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'enabled', COALESCE(
      (SELECT setting_value = 'true' FROM public.system_settings WHERE setting_key = 'site_maintenance_enabled'),
      false
    ),
    'message', COALESCE(
      (SELECT setting_value FROM public.system_settings WHERE setting_key = 'site_maintenance_message'),
      'Estamos em manutenção para melhorar sua experiência. Voltamos em breve!'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_site_maintenance_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_maintenance_status() TO anon, authenticated;
GRANT ALL ON FUNCTION public.get_site_maintenance_status() TO service_role;