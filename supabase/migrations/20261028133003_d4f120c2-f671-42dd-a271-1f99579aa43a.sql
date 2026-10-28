DO $patch$
DECLARE r record; def text; old_guard text := 'IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION ''not_admin''; END IF;';
BEGIN
 FOR r IN SELECT oid,proname FROM pg_proc WHERE oid IN ('public.redeem_mark_shipped(uuid,uuid,text,text)'::regprocedure,'public.redeem_mark_delivered(uuid,uuid,text)'::regprocedure) LOOP
  SELECT pg_get_functiondef(r.oid) INTO def;
  IF position(old_guard IN def)=0 THEN RAISE EXCEPTION 'Unexpected admin guard %',r.proname; END IF;
  EXECUTE replace(def,old_guard,'IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_admin_user(auth.uid()) OR p_admin IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION ''not_admin'' USING ERRCODE=''42501''; END IF;
  ELSIF coalesce(current_setting(''role'',true),''none'') NOT IN (''service_role'',''none'',''postgres'',''supabase_admin'') OR session_user NOT IN (''postgres'',''supabase_admin'',''authenticator'',''service_role'') THEN RAISE EXCEPTION ''not_admin'' USING ERRCODE=''42501'';
  END IF;
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION ''not_admin'' USING ERRCODE=''42501''; END IF;');
 END LOOP;
 SELECT pg_get_functiondef('public.redeem_cancel(uuid,text)'::regprocedure) INTO def;
 IF position('SELECT * INTO r FROM public.points_redemptions' IN def)=0 THEN RAISE EXCEPTION 'Unexpected cancellation definition'; END IF;
 EXECUTE replace(def,'SELECT * INTO r FROM public.points_redemptions','IF v_actor IS NULL THEN RAISE EXCEPTION ''not_authenticated'' USING ERRCODE=''42501''; END IF;
  SELECT * INTO r FROM public.points_redemptions');
 SELECT pg_get_functiondef('public.place_bid(uuid,uuid)'::regprocedure) INTO def;
 IF position('IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN' IN def)=0 THEN RAISE EXCEPTION 'Unexpected bid definition'; END IF;
 EXECUTE replace(def,'IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN','IF auth.uid() IS NULL AND (coalesce(current_setting(''role'',true),''none'') NOT IN (''service_role'',''none'',''postgres'',''supabase_admin'') OR session_user NOT IN (''postgres'',''supabase_admin'',''authenticator'',''service_role'')) THEN RAISE EXCEPTION ''not_authenticated'' USING ERRCODE=''42501''; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN');
 SELECT pg_get_functiondef('public.redeem_create(jsonb,jsonb,text)'::regprocedure) INTO def;
 IF position('SELECT setting_value INTO v_store_on' IN def)=0 OR position('SELECT setting_value INTO v_redeem_on' IN def)=0 THEN RAISE EXCEPTION 'Unexpected redemption settings'; END IF;
 def := replace(def,'SELECT setting_value INTO v_store_on  FROM public.points_program_settings_bool WHERE setting_key=','SELECT value INTO v_store_on FROM public.points_program_settings_bool WHERE key=');
 def := replace(def,'SELECT setting_value INTO v_redeem_on FROM public.points_program_settings_bool WHERE setting_key=','SELECT value INTO v_redeem_on FROM public.points_program_settings_bool WHERE key=');
 EXECUTE def;
END $patch$;
REVOKE EXECUTE ON FUNCTION public.redeem_mark_shipped(uuid,uuid,text,text),public.redeem_mark_delivered(uuid,uuid,text),public.redeem_cancel(uuid,text),public.place_bid(uuid,uuid),public.redeem_create(jsonb,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.redeem_mark_shipped(uuid,uuid,text,text),public.redeem_mark_delivered(uuid,uuid,text),public.redeem_cancel(uuid,text),public.place_bid(uuid,uuid),public.redeem_create(jsonb,jsonb,text) TO authenticated,service_role;