-- ============================================================
-- AUTOMACAO INTEGRAL SEMANAL — PROGRAMA DE EXPANSAO
-- Apenas coordenacao/fiscalizacao. Nenhuma formula comercial alterada.
-- ============================================================

-- 1) NUCLEO CANONICO DE INTEGRIDADE ---------------------------------
-- Gera a versao interna a partir da definicao administrativa vigente
-- (mesmas regras, sem exigencia de sessao admin).
DO $mig$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'expansion_admin_integrity_check';

  d := replace(d, 'public.expansion_admin_integrity_check(_limit integer DEFAULT 300)',
                  'public.expansion_integrity_rows(_limit integer DEFAULT 1000)');
  d := replace(d, 'IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION ''not authorized''; END IF;', '');
  EXECUTE d;
END $mig$;

REVOKE ALL ON FUNCTION public.expansion_integrity_rows(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_integrity_rows(integer) FROM anon;
REVOKE ALL ON FUNCTION public.expansion_integrity_rows(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_integrity_rows(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.expansion_integrity_core(_period_start date DEFAULT NULL, _limit integer DEFAULT 1000)
RETURNS TABLE(severity text, code text, title text, detail text, user_id uuid,
              partner_name text, period_start date, reference text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY
  SELECT r.severity, r.code, r.title, r.detail, r.user_id, r.partner_name, r.period_start, r.reference
    FROM public.expansion_integrity_rows(COALESCE(_limit,1000)) r
   WHERE _period_start IS NULL OR r.period_start IS NULL OR r.period_start = _period_start;
END; $$;

REVOKE ALL ON FUNCTION public.expansion_integrity_core(date,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_integrity_core(date,integer) FROM anon;
REVOKE ALL ON FUNCTION public.expansion_integrity_core(date,integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_integrity_core(date,integer) TO service_role;

-- wrapper administrativo passa a consumir o mesmo nucleo
CREATE OR REPLACE FUNCTION public.expansion_admin_integrity_check(_limit integer DEFAULT 300)
RETURNS TABLE(severity text, code text, title text, detail text, user_id uuid,
              partner_name text, period_start date, reference text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY SELECT * FROM public.expansion_integrity_core(NULL, COALESCE(_limit,300));
END; $$;

-- 2) TABELA DE ORQUESTRACAO ----------------------------------------
CREATE TABLE IF NOT EXISTS public.expansion_orchestration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  orchestration_reference text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  current_stage text,
  close_status text NOT NULL DEFAULT 'NOT_STARTED',
  release_status text NOT NULL DEFAULT 'NOT_STARTED',
  financial_audit_status text NOT NULL DEFAULT 'NOT_STARTED',
  career_dry_run_status text NOT NULL DEFAULT 'NOT_STARTED',
  career_official_status text NOT NULL DEFAULT 'NOT_STARTED',
  notification_status text NOT NULL DEFAULT 'NOT_STARTED',
  final_audit_status text NOT NULL DEFAULT 'NOT_STARTED',
  retry_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  next_retry_at timestamptz,
  close_run_id uuid,
  career_run_id uuid,
  stages jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expansion_orch_period_unique UNIQUE (period_start),
  CONSTRAINT expansion_orch_reference_unique UNIQUE (orchestration_reference)
);

GRANT ALL ON public.expansion_orchestration_runs TO service_role;
GRANT SELECT ON public.expansion_orchestration_runs TO authenticated;
ALTER TABLE public.expansion_orchestration_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins visualizam a automacao semanal" ON public.expansion_orchestration_runs;
CREATE POLICY "Admins visualizam a automacao semanal"
  ON public.expansion_orchestration_runs FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_expansion_orch_status
  ON public.expansion_orchestration_runs (status, next_retry_at);

CREATE OR REPLACE FUNCTION public.expansion_orch_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_expansion_orch_touch ON public.expansion_orchestration_runs;
CREATE TRIGGER trg_expansion_orch_touch BEFORE UPDATE ON public.expansion_orchestration_runs
FOR EACH ROW EXECUTE FUNCTION public.expansion_orch_touch();

-- 3) HELPERS DE ETAPA ----------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_orch_stage_begin(_run_id uuid, _stage text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_att integer;
BEGIN
  SELECT COALESCE((stages->_stage->>'attempt_count')::int,0) + 1 INTO v_att
    FROM public.expansion_orchestration_runs WHERE id=_run_id;
  UPDATE public.expansion_orchestration_runs
     SET current_stage = _stage,
         stages = jsonb_set(COALESCE(stages,'{}'::jsonb), ARRAY[_stage],
                   COALESCE(stages->_stage,'{}'::jsonb) || jsonb_build_object(
                     'status','PROCESSING','started_at',now(),'attempt_count',v_att,
                     'finished_at',NULL,'error_summary',NULL,'next_retry_at',NULL), true)
   WHERE id=_run_id;
  RETURN v_att;
END; $$;
REVOKE ALL ON FUNCTION public.expansion_orch_stage_begin(uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.expansion_orch_stage_end(
  _run_id uuid, _stage text, _status text, _result jsonb DEFAULT '{}'::jsonb,
  _error text DEFAULT NULL, _next_retry timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.expansion_orchestration_runs
     SET stages = jsonb_set(COALESCE(stages,'{}'::jsonb), ARRAY[_stage],
                   COALESCE(stages->_stage,'{}'::jsonb) || jsonb_build_object(
                     'status',_status,'finished_at',now(),
                     'result_summary',COALESCE(_result,'{}'::jsonb),
                     'error_summary',_error,'next_retry_at',_next_retry), true),
         close_status            = CASE WHEN _stage='CLOSE' THEN _status ELSE close_status END,
         release_status          = CASE WHEN _stage='RELEASE' THEN _status ELSE release_status END,
         financial_audit_status  = CASE WHEN _stage='FINANCIAL_INTEGRITY' THEN _status ELSE financial_audit_status END,
         career_dry_run_status   = CASE WHEN _stage='CAREER_DRY_RUN' THEN _status ELSE career_dry_run_status END,
         career_official_status  = CASE WHEN _stage='CAREER_OFFICIAL' THEN _status ELSE career_official_status END,
         notification_status     = CASE WHEN _stage='RANK_NOTIFICATIONS' THEN _status ELSE notification_status END,
         final_audit_status      = CASE WHEN _stage='FINAL_INTEGRITY' THEN _status ELSE final_audit_status END
   WHERE id=_run_id;
END; $$;
REVOKE ALL ON FUNCTION public.expansion_orch_stage_end(uuid,text,text,jsonb,text,timestamptz) FROM PUBLIC, anon, authenticated;

-- alerta administrativo objetivo (idempotente por referencia)
CREATE OR REPLACE FUNCTION public.expansion_admin_alert(_ref text, _title text, _message text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT p.user_id FROM public.profiles p WHERE COALESCE(p.is_admin,false) = true LOOP
    IF r.user_id IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.notifications
                WHERE user_id = r.user_id AND metadata->>'ref' = _ref) THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (r.user_id, 'expansion_orchestration', _title, _message,
            '/dashboard?tab=expansion&secao=automacao', jsonb_build_object('ref', _ref));
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.expansion_admin_alert(text,text,text) FROM PUBLIC, anon, authenticated;

-- 4) ORQUESTRADOR SEMANAL ------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_run_weekly_orchestration(
  _period_start date DEFAULT NULL, _reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  MAXA constant int := 6;
  v_enabled boolean; v_career_flag boolean; v_notif_flag boolean;
  v_period date; v_end date; v_ref text; v_as_of timestamptz;
  v_run public.expansion_orchestration_runs%ROWTYPE;
  v_st jsonb; v_res jsonb; v_att int;
  v_close_run uuid; v_career_run uuid;
  v_crit int := 0; v_high int := 0; v_med int := 0; v_info int := 0;
  v_rel_count int := 0; v_rel_total numeric := 0; v_pending int := 0;
  v_promoted int := 0; v_downgraded int := 0; v_unchanged int := 0;
  v_partners int := 0; v_notified int := 0; v_with_bonus int := 0;
  e record; v_final text;
BEGIN
  v_enabled := COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::boolean FROM public.system_settings
                          WHERE setting_key='expansion_weekly_orchestration_enabled'), false);
  IF NOT v_enabled THEN RETURN jsonb_build_object('status','SKIPPED_DISABLED'); END IF;

  v_period := COALESCE(_period_start, public.expansion_last_closed_week());
  IF v_period IS NULL THEN RETURN jsonb_build_object('status','NO_PERIOD'); END IF;
  v_end := v_period + 6;
  IF v_end >= public.expansion_bahia_today() THEN
    RETURN jsonb_build_object('status','PERIOD_NOT_ENDED','period_start',v_period);
  END IF;
  v_ref := COALESCE(_reference, 'expansion_orchestration:weekly:' || v_period::text);
  v_as_of := ((v_end + 1)::timestamp AT TIME ZONE 'America/Bahia') - interval '1 millisecond';

  IF NOT pg_try_advisory_xact_lock(hashtext('expansion_orchestration:' || v_period::text)) THEN
    RETURN jsonb_build_object('status','LOCKED','period_start',v_period);
  END IF;

  SELECT * INTO v_run FROM public.expansion_orchestration_runs WHERE period_start = v_period;
  IF NOT FOUND THEN
    INSERT INTO public.expansion_orchestration_runs (period_start, period_end, orchestration_reference,
      status, current_stage, started_at)
    VALUES (v_period, v_end, v_ref, 'PROCESSING', 'CLOSE', now()) RETURNING * INTO v_run;
  ELSIF v_run.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('status','ALREADY_COMPLETED','period_start',v_period,'run_id',v_run.id);
  ELSE
    UPDATE public.expansion_orchestration_runs
       SET status='PROCESSING', retry_count = retry_count + 1, next_retry_at=NULL,
           error_summary=NULL, finished_at=NULL
     WHERE id = v_run.id RETURNING * INTO v_run;
  END IF;

  v_close_run := v_run.close_run_id;
  v_career_run := v_run.career_run_id;

  -- ---------------- CLOSE ----------------
  v_st := COALESCE(v_run.stages->'CLOSE','{}'::jsonb);
  IF COALESCE(v_st->>'status','NOT_STARTED') <> 'COMPLETED' THEN
    IF COALESCE((v_st->>'attempt_count')::int,0) >= MAXA THEN
      UPDATE public.expansion_orchestration_runs SET status='FAILED', finished_at=now(), next_retry_at=NULL WHERE id=v_run.id;
      RETURN jsonb_build_object('status','FAILED','stage','CLOSE','reason','MAX_ATTEMPTS');
    END IF;
    v_att := public.expansion_orch_stage_begin(v_run.id,'CLOSE');
    BEGIN
      SELECT id INTO v_close_run FROM public.expansion_close_runs
       WHERE period_start=v_period AND status='COMPLETED' ORDER BY created_at DESC LIMIT 1;
      IF v_close_run IS NULL THEN
        IF NOT COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::boolean FROM public.system_settings
                          WHERE setting_key='expansion_weekly_close_enabled'), false) THEN
          PERFORM public.expansion_orch_stage_end(v_run.id,'CLOSE','SKIPPED_DISABLED','{}'::jsonb,
            'expansion_weekly_close_enabled=false', now() + interval '1 hour');
          UPDATE public.expansion_orchestration_runs
             SET status='WAITING_RETRY', next_retry_at=now()+interval '1 hour',
                 error_summary='fechamento desativado por flag' WHERE id=v_run.id;
          RETURN jsonb_build_object('status','WAITING_RETRY','stage','CLOSE','reason','SKIPPED_DISABLED');
        END IF;
        v_res := public.expansion_run_weekly_close(v_period,'CRON',NULL,'orquestracao automatica ' || v_ref);
        SELECT id INTO v_close_run FROM public.expansion_close_runs
         WHERE period_start=v_period AND status='COMPLETED' ORDER BY created_at DESC LIMIT 1;
        IF v_close_run IS NULL THEN
          RAISE EXCEPTION 'fechamento oficial nao concluido: %', COALESCE(v_res->>'status','?');
        END IF;
        PERFORM public.expansion_orch_stage_end(v_run.id,'CLOSE','COMPLETED',
          jsonb_build_object('reused',false,'close_run_id',v_close_run,'result',v_res));
      ELSE
        PERFORM public.expansion_orch_stage_end(v_run.id,'CLOSE','COMPLETED',
          jsonb_build_object('reused',true,'close_run_id',v_close_run));
      END IF;
      UPDATE public.expansion_orchestration_runs SET close_run_id=v_close_run WHERE id=v_run.id;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.expansion_orch_stage_end(v_run.id,'CLOSE','WAITING_RETRY','{}'::jsonb,
        left(SQLERRM,500), now()+interval '30 minutes');
      UPDATE public.expansion_orchestration_runs
         SET status='WAITING_RETRY', next_retry_at=now()+interval '30 minutes', error_summary=left(SQLERRM,500)
       WHERE id=v_run.id;
      RETURN jsonb_build_object('status','WAITING_RETRY','stage','CLOSE','error',SQLERRM);
    END;
  END IF;

  -- ---------------- RELEASE ----------------
  SELECT * INTO v_run FROM public.expansion_orchestration_runs WHERE id=v_run.id;
  v_st := COALESCE(v_run.stages->'RELEASE','{}'::jsonb);
  IF COALESCE(v_st->>'status','NOT_STARTED') NOT IN ('COMPLETED','SKIPPED_NOT_APPLICABLE') THEN
    IF COALESCE((v_st->>'attempt_count')::int,0) >= MAXA THEN
      UPDATE public.expansion_orchestration_runs SET status='FAILED', finished_at=now(), next_retry_at=NULL WHERE id=v_run.id;
      RETURN jsonb_build_object('status','FAILED','stage','RELEASE','reason','MAX_ATTEMPTS');
    END IF;
    v_att := public.expansion_orch_stage_begin(v_run.id,'RELEASE');
    BEGIN
      SELECT count(*) INTO v_pending FROM public.expansion_period_snapshots
       WHERE period_start=v_period AND status_official='closed' AND COALESCE(final_bonus,0) > 0;

      IF v_pending = 0 THEN
        PERFORM public.expansion_orch_stage_end(v_run.id,'RELEASE','SKIPPED_NOT_APPLICABLE',
          jsonb_build_object('reason','sem bonus pendente de liberacao'));
      ELSE
        v_res := public.expansion_release_closed_period(v_period);
        v_rel_count := COALESCE((v_res->>'released')::int,0);
        v_rel_total := COALESCE((v_res->>'total_amount')::numeric,0);
        SELECT count(*) INTO v_pending FROM public.expansion_period_snapshots
         WHERE period_start=v_period AND status_official='closed' AND COALESCE(final_bonus,0) > 0;
        IF v_pending > 0 THEN
          PERFORM public.expansion_orch_stage_end(v_run.id,'RELEASE','WAITING_RETRY',
            jsonb_build_object('released',v_rel_count,'total_amount',v_rel_total,'pending',v_pending),
            'liberacao pendente', now()+interval '30 minutes');
          UPDATE public.expansion_orchestration_runs
             SET status='WAITING_RETRY', next_retry_at=now()+interval '30 minutes',
                 error_summary='liberacao pendente para ' || v_pending || ' snapshot(s)' WHERE id=v_run.id;
          RETURN jsonb_build_object('status','WAITING_RETRY','stage','RELEASE','pending',v_pending);
        END IF;
        PERFORM public.expansion_orch_stage_end(v_run.id,'RELEASE','COMPLETED',
          jsonb_build_object('released',v_rel_count,'total_amount',v_rel_total));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.expansion_orch_stage_end(v_run.id,'RELEASE','WAITING_RETRY','{}'::jsonb,
        left(SQLERRM,500), now()+interval '30 minutes');
      UPDATE public.expansion_orchestration_runs
         SET status='WAITING_RETRY', next_retry_at=now()+interval '30 minutes', error_summary=left(SQLERRM,500)
       WHERE id=v_run.id;
      RETURN jsonb_build_object('status','WAITING_RETRY','stage','RELEASE','error',SQLERRM);
    END;
  END IF;

  -- ---------------- FINANCIAL_INTEGRITY ----------------
  v_att := public.expansion_orch_stage_begin(v_run.id,'FINANCIAL_INTEGRITY');
  SELECT count(*) FILTER (WHERE severity='CRITICAL'), count(*) FILTER (WHERE severity='HIGH'),
         count(*) FILTER (WHERE severity='MEDIUM'), count(*) FILTER (WHERE severity='INFO')
    INTO v_crit, v_high, v_med, v_info
    FROM public.expansion_integrity_core(v_period, 1000);

  IF v_crit + v_high > 0 THEN
    PERFORM public.expansion_orch_stage_end(v_run.id,'FINANCIAL_INTEGRITY','BLOCKED',
      jsonb_build_object('critical',v_crit,'high',v_high,'medium',v_med,'info',v_info),
      v_crit || ' CRITICAL / ' || v_high || ' HIGH');
    UPDATE public.expansion_orchestration_runs
       SET status='BLOCKED_INTEGRITY', current_stage='FINANCIAL_INTEGRITY', finished_at=now(), next_retry_at=NULL,
           error_summary='auditoria bloqueou a carreira: ' || v_crit || ' CRITICAL / ' || v_high || ' HIGH',
           summary = jsonb_build_object('critical',v_crit,'high',v_high,'medium',v_med,'info',v_info)
     WHERE id=v_run.id;
    PERFORM public.expansion_admin_alert(v_ref || ':alert:integrity',
      'Programa de Expansão requer atenção',
      'Período ' || to_char(v_period,'DD/MM/YYYY') || ' a ' || to_char(v_end,'DD/MM/YYYY') ||
      ' — etapa AUDITORIA FINANCEIRA. Severidade: ' || CASE WHEN v_crit>0 THEN 'CRÍTICA' ELSE 'ALTA' END ||
      '. Problema: ' || v_crit || ' ocorrência(s) crítica(s) e ' || v_high || ' alta(s). ' ||
      'Tentativas: ' || v_att || '. Recuperação automática: avaliação de carreira e notificações bloqueadas; ' ||
      'fechamento, consumos, carteira e payouts preservados. Automação Semanal: /dashboard?tab=expansion&secao=automacao');
    RETURN jsonb_build_object('status','BLOCKED_INTEGRITY','critical',v_crit,'high',v_high,
                              'medium',v_med,'info',v_info,'period_start',v_period);
  END IF;
  PERFORM public.expansion_orch_stage_end(v_run.id,'FINANCIAL_INTEGRITY','COMPLETED',
    jsonb_build_object('critical',0,'high',0,'medium',v_med,'info',v_info));

  -- ---------------- CAREER_DRY_RUN ----------------
  SELECT * INTO v_run FROM public.expansion_orchestration_runs WHERE id=v_run.id;
  v_st := COALESCE(v_run.stages->'CAREER_DRY_RUN','{}'::jsonb);
  IF COALESCE(v_st->>'status','NOT_STARTED') <> 'COMPLETED' THEN
    IF COALESCE((v_st->>'attempt_count')::int,0) >= MAXA THEN
      UPDATE public.expansion_orchestration_runs SET status='FAILED', finished_at=now(), next_retry_at=NULL WHERE id=v_run.id;
      RETURN jsonb_build_object('status','FAILED','stage','CAREER_DRY_RUN','reason','MAX_ATTEMPTS');
    END IF;
    v_att := public.expansion_orch_stage_begin(v_run.id,'CAREER_DRY_RUN');
    BEGIN
      v_res := public.expansion_run_career_evaluation(v_period,'DRY_RUN',
        'career:dryrun:' || v_period::text || ':' || gen_random_uuid()::text, v_as_of, NULL);
      IF COALESCE(v_res->>'status','') <> 'COMPLETED' THEN
        PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_DRY_RUN','BLOCKED',
          jsonb_build_object('result',v_res), COALESCE(v_res->>'reason',v_res->>'status'));
        UPDATE public.expansion_orchestration_runs
           SET status='BLOCKED_INTEGRITY', current_stage='CAREER_DRY_RUN', finished_at=now(), next_retry_at=NULL,
               error_summary='simulacao de carreira nao concluiu: ' || COALESCE(v_res->>'reason',v_res->>'status')
         WHERE id=v_run.id;
        PERFORM public.expansion_admin_alert(v_ref || ':alert:dryrun',
          'Programa de Expansão requer atenção',
          'Período ' || to_char(v_period,'DD/MM/YYYY') || ' — etapa SIMULAÇÃO DE CARREIRA. Severidade: ALTA. ' ||
          'Problema: ' || COALESCE(v_res->>'reason',v_res->>'status') || '. Tentativas: ' || v_att ||
          '. Recuperação automática: avaliação oficial bloqueada; nenhuma graduação alterada; ' ||
          'fechamento financeiro preservado. Automação Semanal: /dashboard?tab=expansion&secao=automacao');
        RETURN jsonb_build_object('status','BLOCKED_INTEGRITY','stage','CAREER_DRY_RUN','result',v_res);
      END IF;
      PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_DRY_RUN','COMPLETED',
        jsonb_build_object('passes',v_res->'passes','total_partners',v_res->'total_partners',
          'promoted',v_res->'promoted','downgraded',v_res->'downgraded','unchanged',v_res->'unchanged'));
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_DRY_RUN','WAITING_RETRY','{}'::jsonb,
        left(SQLERRM,500), now()+interval '30 minutes');
      UPDATE public.expansion_orchestration_runs
         SET status='WAITING_RETRY', next_retry_at=now()+interval '30 minutes', error_summary=left(SQLERRM,500)
       WHERE id=v_run.id;
      RETURN jsonb_build_object('status','WAITING_RETRY','stage','CAREER_DRY_RUN','error',SQLERRM);
    END;
  END IF;

  -- ---------------- CAREER_OFFICIAL ----------------
  SELECT * INTO v_run FROM public.expansion_orchestration_runs WHERE id=v_run.id;
  v_st := COALESCE(v_run.stages->'CAREER_OFFICIAL','{}'::jsonb);
  IF COALESCE(v_st->>'status','NOT_STARTED') <> 'COMPLETED' THEN
    IF COALESCE((v_st->>'attempt_count')::int,0) >= MAXA THEN
      UPDATE public.expansion_orchestration_runs SET status='FAILED', finished_at=now(), next_retry_at=NULL WHERE id=v_run.id;
      RETURN jsonb_build_object('status','FAILED','stage','CAREER_OFFICIAL','reason','MAX_ATTEMPTS');
    END IF;
    v_career_flag := COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::boolean FROM public.system_settings
                                WHERE setting_key='expansion_career_evaluation_enabled'), false);
    v_att := public.expansion_orch_stage_begin(v_run.id,'CAREER_OFFICIAL');
    IF NOT v_career_flag THEN
      PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_OFFICIAL','SKIPPED_DISABLED','{}'::jsonb,
        'expansion_career_evaluation_enabled=false', now()+interval '1 hour');
      UPDATE public.expansion_orchestration_runs
         SET status='WAITING_RETRY', next_retry_at=now()+interval '1 hour',
             error_summary='avaliacao de carreira desativada por flag' WHERE id=v_run.id;
      RETURN jsonb_build_object('status','WAITING_RETRY','stage','CAREER_OFFICIAL','reason','SKIPPED_DISABLED');
    END IF;
    BEGIN
      v_res := public.expansion_run_career_evaluation(v_period,'OFFICIAL',
        'career:weekly:' || v_period::text, v_as_of, NULL);
      IF COALESCE(v_res->>'status','') NOT IN ('COMPLETED','ALREADY_PROCESSED') THEN
        RAISE EXCEPTION 'avaliacao oficial retornou %', COALESCE(v_res->>'status','?');
      END IF;
      v_career_run := COALESCE(NULLIF(v_res->>'run_id','')::uuid, v_career_run);
      v_promoted := COALESCE((v_res->>'promoted')::int,0);
      v_downgraded := COALESCE((v_res->>'downgraded')::int,0);
      v_unchanged := COALESCE((v_res->>'unchanged')::int,0);
      v_partners := COALESCE((v_res->>'total_partners')::int,0);
      UPDATE public.expansion_orchestration_runs SET career_run_id=v_career_run WHERE id=v_run.id;
      PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_OFFICIAL','COMPLETED',
        jsonb_build_object('run_id',v_career_run,'status',v_res->>'status','promoted',v_promoted,
          'downgraded',v_downgraded,'unchanged',v_unchanged,'total_partners',v_partners));
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_OFFICIAL','WAITING_RETRY','{}'::jsonb,
        left(SQLERRM,500), now()+interval '30 minutes');
      UPDATE public.expansion_orchestration_runs
         SET status='WAITING_RETRY', next_retry_at=now()+interval '30 minutes', error_summary=left(SQLERRM,500)
       WHERE id=v_run.id;
      RETURN jsonb_build_object('status','WAITING_RETRY','stage','CAREER_OFFICIAL','error',SQLERRM);
    END;
  ELSE
    v_promoted := COALESCE((v_st->'result_summary'->>'promoted')::int,0);
    v_downgraded := COALESCE((v_st->'result_summary'->>'downgraded')::int,0);
    v_unchanged := COALESCE((v_st->'result_summary'->>'unchanged')::int,0);
    v_partners := COALESCE((v_st->'result_summary'->>'total_partners')::int,0);
  END IF;

  -- ---------------- RANK_NOTIFICATIONS ----------------
  SELECT * INTO v_run FROM public.expansion_orchestration_runs WHERE id=v_run.id;
  v_career_run := COALESCE(v_run.career_run_id, v_career_run);
  v_st := COALESCE(v_run.stages->'RANK_NOTIFICATIONS','{}'::jsonb);
  IF COALESCE(v_st->>'status','NOT_STARTED') NOT IN ('COMPLETED','SKIPPED_NOT_APPLICABLE') THEN
    v_att := public.expansion_orch_stage_begin(v_run.id,'RANK_NOTIFICATIONS');
    v_notif_flag := COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::boolean FROM public.system_settings
                               WHERE setting_key='expansion_career_notifications_enabled'), false);
    IF v_career_run IS NULL THEN
      PERFORM public.expansion_orch_stage_end(v_run.id,'RANK_NOTIFICATIONS','SKIPPED_NOT_APPLICABLE',
        jsonb_build_object('reason','sem avaliacao oficial associada'));
    ELSIF NOT v_notif_flag THEN
      PERFORM public.expansion_orch_stage_end(v_run.id,'RANK_NOTIFICATIONS','SKIPPED_DISABLED','{}'::jsonb,
        'expansion_career_notifications_enabled=false', now()+interval '1 hour');
    ELSE
      FOR e IN SELECT id FROM public.expansion_rank_evaluations
                WHERE run_id = v_career_run AND evaluated_rank IS DISTINCT FROM previous_rank LOOP
        BEGIN
          PERFORM public.expansion_notify_rank_change(e.id);
          v_notified := v_notified + 1;
        EXCEPTION WHEN OTHERS THEN NULL; END;
      END LOOP;
      PERFORM public.expansion_orch_stage_end(v_run.id,'RANK_NOTIFICATIONS','COMPLETED',
        jsonb_build_object('notified',v_notified));
    END IF;
  ELSE
    v_notified := COALESCE((v_st->'result_summary'->>'notified')::int,0);
  END IF;

  -- ---------------- FINAL_INTEGRITY ----------------
  v_att := public.expansion_orch_stage_begin(v_run.id,'FINAL_INTEGRITY');
  SELECT count(*) FILTER (WHERE severity='CRITICAL'), count(*) FILTER (WHERE severity='HIGH'),
         count(*) FILTER (WHERE severity='MEDIUM'), count(*) FILTER (WHERE severity='INFO')
    INTO v_crit, v_high, v_med, v_info
    FROM public.expansion_integrity_core(v_period, 1000);
  PERFORM public.expansion_orch_stage_end(v_run.id,'FINAL_INTEGRITY',
    CASE WHEN v_crit+v_high = 0 THEN 'COMPLETED' ELSE 'BLOCKED' END,
    jsonb_build_object('critical',v_crit,'high',v_high,'medium',v_med,'info',v_info),
    CASE WHEN v_crit+v_high = 0 THEN NULL ELSE v_crit || ' CRITICAL / ' || v_high || ' HIGH' END);

  -- ---------------- ADMIN_SUMMARY ----------------
  SELECT count(*), COALESCE(SUM(final_bonus),0) INTO v_with_bonus, v_rel_total
    FROM public.expansion_period_snapshots
   WHERE period_start=v_period AND COALESCE(final_bonus,0) > 0;
  SELECT count(*) INTO v_rel_count FROM public.expansion_period_snapshots
   WHERE period_start=v_period AND status_official='released';

  v_att := public.expansion_orch_stage_begin(v_run.id,'ADMIN_SUMMARY');
  v_final := CASE WHEN v_crit+v_high = 0 THEN 'COMPLETED' ELSE 'PARTIAL_FAILURE' END;

  IF v_final = 'COMPLETED' THEN
    PERFORM public.expansion_admin_alert(v_ref || ':summary',
      'Programa de Expansão processado',
      'Período ' || to_char(v_period,'DD/MM/YYYY') || ' a ' || to_char(v_end,'DD/MM/YYYY') ||
      '. Parceiros analisados: ' || v_partners ||
      '. Parceiros com bônus: ' || v_with_bonus ||
      '. Total liberado na carteira: R$ ' || public.expansion_fmt_br(v_rel_total,2) ||
      '. Promoções: ' || v_promoted || '. Rebaixamentos: ' || v_downgraded ||
      '. Notificações enviadas: ' || v_notified ||
      '. Conclusão: ' || to_char(now() AT TIME ZONE 'America/Bahia','DD/MM/YYYY HH24:MI') || ' (Bahia).');
  ELSE
    PERFORM public.expansion_admin_alert(v_ref || ':alert:final',
      'Programa de Expansão requer atenção',
      'Período ' || to_char(v_period,'DD/MM/YYYY') || ' — etapa AUDITORIA FINAL. Severidade: ' ||
      CASE WHEN v_crit>0 THEN 'CRÍTICA' ELSE 'ALTA' END || '. Problema: ' || v_crit ||
      ' ocorrência(s) crítica(s) e ' || v_high || ' alta(s) após o processamento. Tentativas: ' || v_att ||
      '. Recuperação automática executada; fechamento, carteira e graduações preservados. ' ||
      'Automação Semanal: /dashboard?tab=expansion&secao=automacao');
  END IF;

  PERFORM public.expansion_orch_stage_end(v_run.id,'ADMIN_SUMMARY','COMPLETED',
    jsonb_build_object('type', CASE WHEN v_final='COMPLETED' THEN 'SUCCESS' ELSE 'ATTENTION' END));

  UPDATE public.expansion_orchestration_runs
     SET status=v_final, current_stage='ADMIN_SUMMARY', finished_at=now(), next_retry_at=NULL,
         summary = jsonb_build_object('partners',v_partners,'partners_with_bonus',v_with_bonus,
           'released_total',v_rel_total,'released_snapshots',v_rel_count,'promoted',v_promoted,
           'downgraded',v_downgraded,'unchanged',v_unchanged,'notified',v_notified,
           'critical',v_crit,'high',v_high,'medium',v_med,'info',v_info)
   WHERE id=v_run.id;

  RETURN jsonb_build_object('status',v_final,'period_start',v_period,'period_end',v_end,
    'run_id',v_run.id,'reference',v_ref,'close_run_id',v_close_run,'career_run_id',v_career_run,
    'partners',v_partners,'partners_with_bonus',v_with_bonus,'released_total',v_rel_total,
    'promoted',v_promoted,'downgraded',v_downgraded,'unchanged',v_unchanged,'notified',v_notified,
    'integrity',jsonb_build_object('critical',v_crit,'high',v_high,'medium',v_med,'info',v_info));
END; $$;

REVOKE ALL ON FUNCTION public.expansion_run_weekly_orchestration(date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_run_weekly_orchestration(date,text) TO service_role;

-- 5) RECUPERACAO AUTOMATICA ----------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_recover_weekly_orchestration()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_res jsonb; v_out jsonb := '[]'::jsonb; v_n int := 0; v_last date; v_enabled boolean;
BEGIN
  v_enabled := COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::boolean FROM public.system_settings
                          WHERE setting_key='expansion_weekly_orchestration_enabled'), false);
  IF NOT v_enabled THEN RETURN jsonb_build_object('status','SKIPPED_DISABLED'); END IF;

  v_last := public.expansion_last_closed_week();
  IF v_last IS NOT NULL AND (v_last + 6) < public.expansion_bahia_today()
     AND NOT EXISTS (SELECT 1 FROM public.expansion_orchestration_runs WHERE period_start = v_last) THEN
    v_res := public.expansion_run_weekly_orchestration(v_last, NULL);
    v_out := v_out || jsonb_build_array(jsonb_build_object('period_start',v_last,'action','CREATED','result',v_res));
    v_n := v_n + 1;
  END IF;

  FOR r IN
    SELECT * FROM public.expansion_orchestration_runs
     WHERE status NOT IN ('COMPLETED','FAILED')
       AND (
         (status IN ('WAITING_RETRY','PARTIAL_FAILURE') AND COALESCE(next_retry_at, now()) <= now())
         OR (status='PROCESSING' AND updated_at < now() - interval '1 hour')
         OR (status='BLOCKED_INTEGRITY' AND updated_at < now() - interval '12 hours')
       )
     ORDER BY period_start LIMIT 5
  LOOP
    BEGIN
      v_res := public.expansion_run_weekly_orchestration(r.period_start, NULL);
      v_out := v_out || jsonb_build_array(jsonb_build_object('period_start',r.period_start,'action','RESUMED','result',v_res));
      v_n := v_n + 1;
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_array(jsonb_build_object('period_start',r.period_start,'action','ERROR','error',SQLERRM));
    END;
  END LOOP;

  -- limite de tentativas por etapa atingido -> alerta unico, dados intactos
  FOR r IN
    SELECT o.* FROM public.expansion_orchestration_runs o
     WHERE o.status NOT IN ('COMPLETED','FAILED')
       AND EXISTS (SELECT 1 FROM jsonb_each(o.stages) s
                    WHERE COALESCE((s.value->>'attempt_count')::int,0) >= 6
                      AND COALESCE(s.value->>'status','') NOT IN ('COMPLETED','SKIPPED_NOT_APPLICABLE'))
  LOOP
    UPDATE public.expansion_orchestration_runs
       SET status = CASE WHEN status='BLOCKED_INTEGRITY' THEN 'BLOCKED_INTEGRITY' ELSE 'FAILED' END,
           next_retry_at=NULL, finished_at=COALESCE(finished_at, now())
     WHERE id = r.id;
    PERFORM public.expansion_admin_alert(r.orchestration_reference || ':alert:max_attempts',
      'Programa de Expansão requer atenção',
      'Período ' || to_char(r.period_start,'DD/MM/YYYY') || ' — etapa ' || COALESCE(r.current_stage,'?') ||
      '. Severidade: CRÍTICA. Problema: não concluída após 6 tentativas automáticas. ' ||
      'Erro: ' || COALESCE(left(r.error_summary,200),'—') ||
      '. Recuperação automática encerrada; dados financeiros e graduações preservados. ' ||
      'Automação Semanal: /dashboard?tab=expansion&secao=automacao');
  END LOOP;

  RETURN jsonb_build_object('status','COMPLETED','processed',v_n,'details',v_out);
END; $$;

REVOKE ALL ON FUNCTION public.expansion_recover_weekly_orchestration() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_recover_weekly_orchestration() TO service_role;

-- 6) LEITURA E ACOES DO PAINEL --------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_orchestration(_limit integer DEFAULT 20)
RETURNS SETOF public.expansion_orchestration_runs
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY SELECT * FROM public.expansion_orchestration_runs
                ORDER BY period_start DESC LIMIT COALESCE(_limit,20);
END; $$;
GRANT EXECUTE ON FUNCTION public.expansion_admin_orchestration(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.expansion_admin_orchestration_action(
  _period_start date, _action text DEFAULT 'RETRY')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_act text := upper(COALESCE(_action,'RETRY'));
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF v_act NOT IN ('RETRY','DRY_RUN') THEN RAISE EXCEPTION 'acao invalida'; END IF;
  IF _period_start IS NULL THEN RAISE EXCEPTION 'periodo obrigatorio'; END IF;

  IF v_act = 'DRY_RUN' THEN
    RETURN public.expansion_run_career_evaluation(_period_start,'DRY_RUN',
      'career:dryrun:' || _period_start::text || ':' || gen_random_uuid()::text,
      (((_period_start + 7)::timestamp AT TIME ZONE 'America/Bahia') - interval '1 millisecond'),
      auth.uid());
  END IF;

  UPDATE public.expansion_orchestration_runs
     SET next_retry_at = now() - interval '1 minute',
         status = CASE WHEN status='COMPLETED' THEN status ELSE 'WAITING_RETRY' END
   WHERE period_start = _period_start;

  RETURN public.expansion_run_weekly_orchestration(_period_start, NULL);
END; $$;
GRANT EXECUTE ON FUNCTION public.expansion_admin_orchestration_action(date,text) TO authenticated;

-- 7) AGENDAMENTOS (America/Bahia = UTC-3) ---------------------------
-- 00:20 Bahia = 03:20 UTC (segunda)
-- 00:30-05:30 Bahia = 03:30-08:30 UTC (segunda), a cada 30 min
-- 03:40 Bahia = 06:40 UTC (diario)
SELECT cron.unschedule(jobname) FROM cron.job
 WHERE jobname IN ('expansion-weekly-orchestration','expansion-orchestration-recovery',
                   'expansion-orchestration-recovery-daily');

SELECT cron.schedule('expansion-weekly-orchestration', '20 3 * * 1',
  $cron$SELECT public.expansion_run_weekly_orchestration(NULL, NULL);$cron$);
SELECT cron.schedule('expansion-orchestration-recovery', '30,0 3-8 * * 1',
  $cron$SELECT public.expansion_recover_weekly_orchestration();$cron$);
SELECT cron.schedule('expansion-orchestration-recovery-daily', '40 6 * * *',
  $cron$SELECT public.expansion_recover_weekly_orchestration();$cron$);