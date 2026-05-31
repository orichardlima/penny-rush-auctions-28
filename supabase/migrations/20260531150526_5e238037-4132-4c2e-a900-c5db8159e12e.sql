
-- Tabela de auditoria de impersonation
CREATE TABLE public.admin_impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_email text,
  mode text NOT NULL CHECK (mode IN ('view_as','login_as')),
  reason text NOT NULL CHECK (length(reason) >= 10),
  ip_address text,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  ended_at timestamptz
);

CREATE INDEX idx_impersonation_admin ON public.admin_impersonation_log(admin_user_id, started_at DESC);
CREATE INDEX idx_impersonation_target ON public.admin_impersonation_log(target_user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.admin_impersonation_log TO authenticated;
GRANT ALL ON public.admin_impersonation_log TO service_role;

ALTER TABLE public.admin_impersonation_log ENABLE ROW LEVEL SECURITY;

-- Função para checar super-admin (lê de system_settings)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_settings
    WHERE setting_key = 'super_admin_user_id'
      AND setting_value = _user_id::text
  );
$$;

CREATE POLICY "Super admin can insert impersonation logs"
ON public.admin_impersonation_log FOR INSERT TO authenticated
WITH CHECK (admin_user_id = auth.uid() AND is_super_admin(auth.uid()));

CREATE POLICY "Super admin can read impersonation logs"
ON public.admin_impersonation_log FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

-- Apenas atualizar ended_at na própria entrada
CREATE POLICY "Super admin can close own impersonation"
ON public.admin_impersonation_log FOR UPDATE TO authenticated
USING (admin_user_id = auth.uid() AND is_super_admin(auth.uid()))
WITH CHECK (admin_user_id = auth.uid() AND is_super_admin(auth.uid()));

-- Seed inicial do super-admin (admin existente). Admin pode atualizar via UI/SQL depois.
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'super_admin_user_id',
  'a2e6092e-4621-4170-91d5-b68fbaa09ccd',
  'string',
  'User ID do super-admin autorizado a impersonar contas de parceiros'
)
ON CONFLICT (setting_key) DO NOTHING;
