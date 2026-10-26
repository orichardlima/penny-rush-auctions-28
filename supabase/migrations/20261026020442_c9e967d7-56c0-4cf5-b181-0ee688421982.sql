CREATE OR REPLACE FUNCTION public._is_privileged_writer()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT current_user NOT IN ('authenticated','anon') OR coalesce(public.is_admin_user(auth.uid()), false)
$$;
GRANT EXECUTE ON FUNCTION public._is_privileged_writer() TO authenticated, anon;