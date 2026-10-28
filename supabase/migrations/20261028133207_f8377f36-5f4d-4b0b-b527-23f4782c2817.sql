DO $guard$
DECLARE def text; old_guard text := 'IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION ''not_admin''; END IF;';
BEGIN
 SELECT pg_get_functiondef('public.points_admin_adjust(uuid,bigint,text,uuid,text)'::regprocedure) INTO def;
 IF position(old_guard IN def)=0 THEN RAISE EXCEPTION 'Unexpected adjustment guard'; END IF;
 EXECUTE replace(def,old_guard,'IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_admin_user(auth.uid()) OR p_admin IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION ''not_admin'' USING ERRCODE=''42501''; END IF;
  ELSIF coalesce(current_setting(''role'',true),''none'') NOT IN (''service_role'',''none'',''postgres'',''supabase_admin'') OR session_user NOT IN (''postgres'',''supabase_admin'',''authenticator'',''service_role'') THEN RAISE EXCEPTION ''not_admin'' USING ERRCODE=''42501'';
  END IF;
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION ''not_admin'' USING ERRCODE=''42501''; END IF;');
END $guard$;
REVOKE EXECUTE ON FUNCTION public.points_admin_adjust(uuid,bigint,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.points_admin_adjust(uuid,bigint,text,uuid,text) TO authenticated,service_role;