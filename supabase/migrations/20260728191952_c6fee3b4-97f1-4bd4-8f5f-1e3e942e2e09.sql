CREATE OR REPLACE FUNCTION public.store_visible_for(p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_program boolean; v_store boolean; v_mode text; v_ids jsonb; v_pct int;
BEGIN
  SELECT value INTO v_program FROM public.points_program_settings_bool
   WHERE key='points_program_enabled';
  SELECT value INTO v_store   FROM public.points_program_settings_bool
   WHERE key='points_store_enabled';
  IF COALESCE(v_program,false)=false OR COALESCE(v_store,false)=false THEN RETURN false; END IF;

  IF public.is_admin_user(p_user) THEN RETURN true; END IF;

  SELECT value::text INTO v_mode FROM public.points_program_settings_json
   WHERE key='audience_mode';
  v_mode := COALESCE(trim(both '"' from v_mode), 'admin_only');

  IF v_mode = 'admin_only' THEN RETURN false;
  ELSIF v_mode = 'all' THEN RETURN true;
  ELSIF v_mode = 'pilot' THEN
    SELECT value INTO v_ids FROM public.points_program_settings_json
     WHERE key='audience_pilot_user_ids';
    RETURN v_ids IS NOT NULL AND v_ids ? p_user::text;
  ELSIF v_mode = 'percent' THEN
    SELECT value INTO v_pct FROM public.points_program_settings_num
     WHERE key='audience_percent';
    RETURN (('x'||substr(md5(p_user::text),1,8))::bit(32)::int % 100) < COALESCE(v_pct,0);
  END IF;
  RETURN false;
END $function$;