-- Permitir que qualquer pessoa leia as configurações do sistema
CREATE POLICY "Anyone can read system settings"
ON public.system_settings
FOR SELECT
USING (true);