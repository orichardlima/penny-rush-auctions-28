-- 1) Funções internas de fechamento: somente postgres/service_role
REVOKE ALL ON FUNCTION public.expansion_run_weekly_close(date, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_close_partner_week(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_run_weekly_close(date, text, uuid, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.expansion_close_partner_week(uuid, date, uuid) TO postgres, service_role;

-- 2) Wrappers administrativos com guarda is_admin_user: revogar PUBLIC/anon, manter authenticated
REVOKE ALL ON FUNCTION public.expansion_release_bonus(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expansion_admin_evaluate_career(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expansion_admin_close_week(date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expansion_admin_orchestration(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expansion_admin_orchestration_action(date, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.expansion_release_bonus(uuid, uuid) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_admin_evaluate_career(uuid, text, text) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_admin_close_week(date, text) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_admin_orchestration(integer) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_admin_orchestration_action(date, text) TO postgres, service_role, authenticated;

-- 3) Validação da origem no fechamento semanal (corpo idêntico, apenas guarda de _origin adicionada)
CREATE OR REPLACE FUNCTION public.expansion_run_weekly_close(_period_start date DEFAULT NULL::date, _origin text DEFAULT 'CRON'::text, _admin_id uuid DEFAULT NULL::uuid, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period DATE := COALESCE(_period_start, public.expansion_last_closed_week());
  v_end DATE;
  v_run UUID;
  v_enabled BOOLEAN;
  v_origin TEXT := upper(COALESCE(_origin,'CRON'));
  r RECORD;
  res JSONB;
  v_eligible INT := 0; v_processed INT := 0; v_closed INT := 0;
  v_already INT := 0; v_novol INT := 0; v_err INT := 0;
  v_details JSONB := '[]'::jsonb;
BEGIN
  IF v_origin NOT IN ('CRON','ADMIN','ORCHESTRATION','RECOVERY') THEN
    RAISE EXCEPTION 'invalid origin: %', _origin;
  END IF;

  IF v_origin = 'ADMIN' THEN
    IF _admin_id IS NULL OR NOT public.is_admin_user(_admin_id) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
    IF NULLIF(BTRIM(COALESCE(_reason,'')),'') IS NULL THEN
      RAISE EXCEPTION 'reason is required';
    END IF;
  END IF;

  v_end := v_period + 6;

  IF v_origin <> 'ADMIN' THEN
    v_enabled := COALESCE((SELECT setting_value FROM public.system_settings
                            WHERE setting_key='expansion_weekly_close_enabled') = 'true', false);
    IF NOT v_enabled THEN
      INSERT INTO public.expansion_close_runs
        (period_start, period_end, origin, status, finished_at, reason)
      VALUES (v_period, v_end, v_origin, 'SKIPPED_DISABLED', now(), 'expansion_weekly_close_enabled = false')
      RETURNING id INTO v_run;
      RETURN jsonb_build_object('status','SKIPPED_DISABLED','run_id',v_run,'period_start',v_period);
    END IF;
  END IF;

  IF v_end >= public.expansion_bahia_today() THEN
    RAISE EXCEPTION 'cannot close an open week (% a %)', v_period, v_end;
  END IF;

  INSERT INTO public.expansion_close_runs (period_start, period_end, origin, admin_id, reason, status)
  VALUES (v_period, v_end, v_origin, _admin_id, _reason, 'RUNNING') RETURNING id INTO v_run;

  FOR r IN
    SELECT DISTINCT pc.user_id
      FROM public.partner_contracts pc
     WHERE pc.status='ACTIVE' AND COALESCE(pc.is_demo,false)=false
  LOOP
    v_eligible := v_eligible + 1;
    BEGIN
      res := public.expansion_close_partner_week(r.user_id, v_period, v_run);
      v_processed := v_processed + 1;
      IF res->>'status' = 'ALREADY_CLOSED' THEN v_already := v_already + 1;
      ELSIF res->>'status' = 'CLOSED_NO_VOLUME' THEN v_novol := v_novol + 1; v_closed := v_closed + 1;
      ELSE v_closed := v_closed + 1;
      END IF;
      IF COALESCE((res->>'final_bonus')::numeric,0) > 0 OR res->>'status'='ALREADY_CLOSED' THEN
        v_details := v_details || jsonb_build_array(res);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_err := v_err + 1;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'status','ERROR','user_id',r.user_id,'error',SQLERRM));
    END;
  END LOOP;

  UPDATE public.expansion_close_runs
     SET finished_at=now(), eligible_count=v_eligible, processed_count=v_processed,
         closed_count=v_closed, already_closed_count=v_already, no_volume_count=v_novol,
         error_count=v_err, status=CASE WHEN v_err>0 THEN 'COMPLETED_WITH_ERRORS' ELSE 'COMPLETED' END,
         details=v_details
   WHERE id=v_run;

  RETURN jsonb_build_object('status','COMPLETED','run_id',v_run,'period_start',v_period,'period_end',v_end,
    'eligible',v_eligible,'processed',v_processed,'closed',v_closed,'already_closed',v_already,
    'no_volume',v_novol,'errors',v_err);
END;
$function$;

REVOKE ALL ON FUNCTION public.expansion_run_weekly_close(date, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_run_weekly_close(date, text, uuid, text) TO postgres, service_role;