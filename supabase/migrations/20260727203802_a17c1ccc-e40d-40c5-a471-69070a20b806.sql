
-- Grants required for PostgREST to reach these tables
GRANT SELECT, UPDATE ON public.points_program_settings_bool TO authenticated;
GRANT SELECT, UPDATE ON public.points_program_settings_num  TO authenticated;
GRANT SELECT, UPDATE ON public.points_program_settings_time TO authenticated;
GRANT SELECT, UPDATE ON public.points_program_settings_json TO authenticated;
GRANT ALL ON public.points_program_settings_bool TO service_role;
GRANT ALL ON public.points_program_settings_num  TO service_role;
GRANT ALL ON public.points_program_settings_time TO service_role;
GRANT ALL ON public.points_program_settings_json TO service_role;

-- Admin UPDATE policies (RLS was missing UPDATE entirely)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['points_program_settings_bool','points_program_settings_num','points_program_settings_time','points_program_settings_json']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin updates settings" ON public.%I', t);
    EXECUTE format($p$CREATE POLICY "admin updates settings" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()))$p$, t);
  END LOOP;
END $$;
