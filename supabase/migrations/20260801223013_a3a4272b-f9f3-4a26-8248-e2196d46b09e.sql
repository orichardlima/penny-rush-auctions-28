-- =====================================================================
-- 1) JANELA DE RECUPERACAO
-- =====================================================================
DROP FUNCTION IF EXISTS public.expansion_recover_weekly_orchestration();

CREATE OR REPLACE FUNCTION public.expansion_recover_weekly_orchestration(_enforce_window boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record; v_res jsonb; v_out jsonb := '[]'::jsonb; v_n int := 0; v_last date; v_enabled boolean;
  v_bahia timestamp;
BEGIN
  -- validacao interna obrigatoria da janela: segunda-feira, 00:30..05:30 America/Bahia
  v_bahia := (now() AT TIME ZONE 'America/Bahia');
  IF _enforce_window AND NOT (
       EXTRACT(ISODOW FROM v_bahia)::int = 1
       AND v_bahia::time >= TIME '00:30'
       AND v_bahia::time <= TIME '05:30'
     ) THEN
    RETURN jsonb_build_object(
      'status','SKIPPED_OUTSIDE_RECOVERY_WINDOW',
      'bahia_time', to_char(v_bahia,'YYYY-MM-DD HH24:MI'),
      'window','segunda-feira 00:30-05:30 America/Bahia');
  END IF;

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

  RETURN jsonb_build_object('status','COMPLETED','processed',v_n,
                            'bahia_time', to_char(v_bahia,'YYYY-MM-DD HH24:MI'),'details',v_out);
END; $function$;

REVOKE ALL ON FUNCTION public.expansion_recover_weekly_orchestration(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_recover_weekly_orchestration(boolean) TO service_role;

-- =====================================================================
-- 2) CARREIRA COM RECONCILIACAO AUTOMATICA DE PARCEIROS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.expansion_run_career_evaluation(
  _period_start date DEFAULT NULL::date,
  _mode text DEFAULT 'DRY_RUN'::text,
  _reference text DEFAULT NULL::text,
  _evaluated_as_of timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _triggered_by uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mode text := upper(COALESCE(_mode,'DRY_RUN'));
  v_enabled boolean;
  v_period_start date := _period_start;
  v_period_end date;
  v_as_of timestamptz;
  v_ref text;
  v_run_id uuid;
  v_cfg jsonb;
  v_ctx jsonb := '{}'::jsonb;
  v_prev_ctx jsonb;
  v_max_passes integer;
  v_pass integer := 0;
  v_u record;
  v_state jsonb;
  v_rank text;
  v_stable boolean := false;
  v_results jsonb := '[]'::jsonb;
  v_promoted integer := 0; v_downgraded integer := 0; v_unchanged integer := 0;
  v_total integer := 0; v_res jsonb; v_existing record;
  v_found integer := 0; v_eligible integer := 0; v_excluded integer := 0;
  v_evaluated integer := 0; v_failed integer := 0;
  v_reasons jsonb; v_top_reason text; v_top_reason_count integer := 0;
  v_recon jsonb; v_recon_status text; v_recon_note text;
BEGIN
  IF v_mode NOT IN ('DRY_RUN','OFFICIAL') THEN RAISE EXCEPTION 'modo invalido'; END IF;

  v_enabled := COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::boolean FROM public.system_settings
                          WHERE setting_key='expansion_career_evaluation_enabled'), false);

  IF v_period_start IS NULL THEN
    v_period_start := (public.expansion_bahia_today() - ((EXTRACT(ISODOW FROM public.expansion_bahia_today())::int - 1) + 7))::date;
  END IF;
  v_period_end := v_period_start + 6;
  v_as_of := COALESCE(_evaluated_as_of,
                      ((v_period_end + 1)::timestamp AT TIME ZONE 'America/Bahia') - interval '1 millisecond');
  v_ref := COALESCE(_reference,
                    CASE WHEN v_mode='OFFICIAL' THEN 'career:weekly:' || v_period_start::text
                         ELSE 'career:dryrun:' || gen_random_uuid()::text END);

  IF v_mode = 'OFFICIAL' AND NOT v_enabled THEN
    INSERT INTO public.expansion_rank_runs (run_reference, run_type, period_start, period_end,
      evaluated_as_of, mode, status, triggered_by, error_summary)
    VALUES (v_ref || ':skipped:' || gen_random_uuid()::text, 'WEEKLY', v_period_start, v_period_end,
            v_as_of, v_mode, 'SKIPPED_DISABLED', _triggered_by, 'expansion_career_evaluation_enabled=false');
    RETURN jsonb_build_object('status','SKIPPED_DISABLED','reference',v_ref);
  END IF;

  IF v_mode = 'OFFICIAL' THEN
    SELECT * INTO v_existing FROM public.expansion_rank_runs
     WHERE run_reference = v_ref AND status IN ('COMPLETED','PROCESSING');
    IF FOUND THEN
      RETURN jsonb_build_object('status','ALREADY_PROCESSED','reference',v_ref,'run_id',v_existing.id);
    END IF;
    IF NOT pg_try_advisory_xact_lock(hashtext('expansion_career_evaluation')) THEN
      RETURN jsonb_build_object('status','LOCKED','reference',v_ref);
    END IF;
  END IF;

  v_cfg := public.expansion_career_config_snapshot();

  INSERT INTO public.expansion_rank_runs (run_reference, run_type, period_start, period_end,
    evaluated_as_of, mode, status, config_snapshot, triggered_by)
  VALUES (v_ref, CASE WHEN _reference LIKE 'career:admin:%' THEN 'ADMIN' ELSE 'WEEKLY' END,
          v_period_start, v_period_end, v_as_of, v_mode, 'PROCESSING', v_cfg, _triggered_by)
  RETURNING id INTO v_run_id;

  v_max_passes := (SELECT count(*)::int + 1 FROM public.expansion_career_config WHERE is_active);
  IF v_max_passes < 2 THEN v_max_passes := 2; END IF;

  -- ---------- universo completo e classificacao automatica ----------
  CREATE TEMP TABLE IF NOT EXISTS _career_universe (
    user_id uuid PRIMARY KEY, eligible boolean NOT NULL, reason text
  ) ON COMMIT DROP;
  DELETE FROM _career_universe;

  CREATE TEMP TABLE IF NOT EXISTS _career_failed (user_id uuid PRIMARY KEY) ON COMMIT DROP;
  DELETE FROM _career_failed;

  INSERT INTO _career_universe (user_id, eligible, reason)
  WITH universe AS (
    SELECT DISTINCT user_id FROM public.partner_contracts WHERE status = 'ACTIVE'
    UNION
    SELECT user_id FROM public.expansion_partner_ranks
  ),
  ctx AS (
    SELECT u.user_id,
           EXISTS (SELECT 1 FROM public.expansion_partner_ranks r WHERE r.user_id = u.user_id) AS has_rank,
           (SELECT min(c.created_at) FROM public.partner_contracts c
             WHERE c.user_id = u.user_id AND c.status='ACTIVE' AND c.is_demo IS NOT TRUE) AS first_active_at,
           EXISTS (SELECT 1 FROM public.partner_contracts c
                    WHERE c.user_id = u.user_id AND c.status='ACTIVE' AND c.is_demo IS NOT TRUE) AS has_active,
           EXISTS (SELECT 1 FROM public.partner_contracts c
                    WHERE c.user_id = u.user_id AND c.status='ACTIVE' AND c.is_demo IS TRUE) AS has_demo,
           (SELECT count(*) FROM public.profiles p WHERE p.user_id = u.user_id) AS profile_count,
           COALESCE((SELECT bool_or(COALESCE(p.is_bot,false)) FROM public.profiles p WHERE p.user_id = u.user_id), false) AS is_bot,
           COALESCE((SELECT bool_or(COALESCE(p.is_test_account,false)) FROM public.profiles p WHERE p.user_id = u.user_id), false) AS is_test,
           EXISTS (SELECT 1 FROM public.expansion_team_memberships m
                    WHERE (m.user_id = u.user_id OR m.ancestor_user_id = u.user_id)
                      AND m.effective_from <= v_as_of
                      AND (m.effective_to IS NULL OR m.effective_to > v_as_of)) AS has_position
      FROM universe u
  )
  SELECT c.user_id,
         -- elegibilidade preservada exatamente como no motor aprovado
         (c.has_rank
          OR (c.has_active AND c.first_active_at <= v_as_of AND NOT c.is_bot AND NOT c.is_test)) AS eligible,
         CASE
           WHEN c.has_rank
             OR (c.has_active AND c.first_active_at <= v_as_of AND NOT c.is_bot AND NOT c.is_test) THEN NULL
           WHEN c.is_bot THEN 'BOT'
           WHEN c.is_test THEN 'TEST_ACCOUNT'
           WHEN c.profile_count = 0 THEN 'DELETED_USER'
           WHEN c.profile_count > 1 THEN 'DUPLICATE_PROFILE'
           WHEN c.has_active AND c.first_active_at > v_as_of THEN 'AFTER_EVALUATED_AS_OF'
           WHEN NOT c.has_active AND c.has_demo THEN 'TECHNICAL_ACCOUNT'
           WHEN NOT c.has_position THEN 'NO_EXPANSION_POSITION'
           ELSE 'OTHER'
         END AS reason
    FROM ctx c
  ON CONFLICT (user_id) DO NOTHING;

  SELECT count(*), count(*) FILTER (WHERE eligible), count(*) FILTER (WHERE NOT eligible)
    INTO v_found, v_eligible, v_excluded FROM _career_universe;

  SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb) INTO v_reasons FROM (
    SELECT k, COALESCE((SELECT count(*) FROM _career_universe u
                         WHERE NOT u.eligible AND COALESCE(u.reason,'OTHER') = k), 0) AS n
      FROM unnest(ARRAY['AFTER_EVALUATED_AS_OF','NO_EXPANSION_POSITION','TECHNICAL_ACCOUNT','BOT',
                        'TEST_ACCOUNT','DELETED_USER','DUPLICATE_PROFILE','INVALID_MEMBERSHIP',
                        'OUTSIDE_OFFICIAL_CUTOFF','OTHER']) AS k
  ) t;

  SELECT COALESCE(reason,'OTHER'), count(*) INTO v_top_reason, v_top_reason_count
    FROM _career_universe WHERE NOT eligible
   GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1;

  -- ---------- lote elegivel, ordenado bottom-up ----------
  CREATE TEMP TABLE IF NOT EXISTS _career_batch (user_id uuid PRIMARY KEY, height integer) ON COMMIT DROP;
  DELETE FROM _career_batch;

  INSERT INTO _career_batch (user_id, height)
  SELECT u.user_id,
         COALESCE((SELECT MAX(m.depth) FROM public.expansion_team_memberships m
                    WHERE m.ancestor_user_id = u.user_id
                      AND m.effective_from <= v_as_of
                      AND (m.effective_to IS NULL OR m.effective_to > v_as_of)), 0)
    FROM _career_universe u WHERE u.eligible
  ON CONFLICT (user_id) DO NOTHING;

  SELECT count(*) INTO v_total FROM _career_batch;

  -- passes de estabilizacao
  WHILE v_pass < v_max_passes AND NOT v_stable LOOP
    v_pass := v_pass + 1;
    v_prev_ctx := v_ctx;
    FOR v_u IN SELECT user_id FROM _career_batch ORDER BY height ASC, user_id ASC LOOP
      BEGIN
        v_state := public.expansion_compute_career_state(v_u.user_id, v_as_of, v_ctx);
        v_rank := v_state->>'diagnosed_rank';
        v_ctx := jsonb_set(v_ctx, ARRAY[v_u.user_id::text], to_jsonb(v_rank), true);
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO _career_failed(user_id) VALUES (v_u.user_id) ON CONFLICT DO NOTHING;
        v_ctx := jsonb_set(v_ctx, ARRAY[v_u.user_id::text], to_jsonb(COALESCE(v_ctx->>v_u.user_id::text,'NONE')), true);
      END;
    END LOOP;
    v_stable := (v_ctx = v_prev_ctx);
  END LOOP;

  IF NOT v_stable THEN
    UPDATE public.expansion_rank_runs
       SET status='FAILED', pass_count=v_pass, total_partners=v_total, finished_at=now(),
           error_summary='CRITICAL: avaliacao de carreira nao estabilizou em ' || v_max_passes || ' passes'
     WHERE id = v_run_id;
    RETURN jsonb_build_object('status','FAILED','reason','NOT_STABILIZED','run_id',v_run_id,'passes',v_pass);
  END IF;

  -- resultado projetado / persistencia
  FOR v_u IN SELECT b.user_id, b.height, COALESCE(r.current_rank,'NONE') AS cur
               FROM _career_batch b
               LEFT JOIN public.expansion_partner_ranks r ON r.user_id = b.user_id
              ORDER BY b.height ASC, b.user_id ASC LOOP
    v_rank := COALESCE(v_ctx->>v_u.user_id::text, 'NONE');

    BEGIN
      IF v_mode = 'OFFICIAL' THEN
        v_res := public.expansion_evaluate_career_internal(
          v_u.user_id, v_ref,
          CASE WHEN _reference LIKE 'career:admin:%' THEN 'ADMIN' ELSE 'WEEKLY' END,
          v_run_id, v_as_of, v_run_id, v_ctx, v_cfg, _triggered_by);
      ELSE
        v_res := jsonb_build_object('status',
          CASE WHEN v_rank = v_u.cur THEN 'UNCHANGED'
               WHEN public.expansion_rank_order(v_rank) > public.expansion_rank_order(v_u.cur) THEN 'PROMOTED'
               ELSE 'DOWNGRADED' END,
          'user_id', v_u.user_id, 'previous_rank', v_u.cur, 'evaluated_rank', v_rank);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO _career_failed(user_id) VALUES (v_u.user_id) ON CONFLICT DO NOTHING;
      v_results := v_results || jsonb_build_object('status','FAILED','user_id',v_u.user_id,
                                                   'error',left(SQLERRM,200));
      CONTINUE;
    END;

    IF (v_res->>'status') = 'PROMOTED' THEN v_promoted := v_promoted + 1;
    ELSIF (v_res->>'status') = 'DOWNGRADED' THEN v_downgraded := v_downgraded + 1;
    ELSE v_unchanged := v_unchanged + 1; END IF;

    v_results := v_results || v_res;
  END LOOP;

  SELECT count(*) INTO v_failed FROM _career_failed;
  v_evaluated := v_promoted + v_downgraded + v_unchanged;

  -- ---------- conciliacao automatica ----------
  IF v_found = v_eligible + v_excluded AND v_eligible = v_evaluated + v_failed THEN
    IF COALESCE((v_reasons->>'OTHER')::int,0) > 0 THEN
      v_recon_status := 'HIGH';
      v_recon_note := (v_reasons->>'OTHER') || ' parceiro(s) excluído(s) sem motivo classificável.';
    ELSE
      v_recon_status := 'OK';
      v_recon_note := CASE WHEN v_excluded = 0 THEN 'Todos os parceiros encontrados foram avaliados.'
        ELSE v_excluded || ' parceiro(s) não existiam ou não eram elegíveis no encerramento oficial do período (' ||
             COALESCE(v_top_reason,'OTHER') || ').' END;
    END IF;
  ELSE
    v_recon_status := 'HIGH';
    v_recon_note := 'Falha de conciliação: encontrados ' || v_found || ', elegíveis ' || v_eligible ||
                    ', excluídos ' || v_excluded || ', avaliados ' || v_evaluated || ', falhas ' || v_failed || '.';
  END IF;

  v_recon := jsonb_build_object(
    'total_partners_found', v_found,
    'total_partners_eligible', v_eligible,
    'total_partners_excluded', v_excluded,
    'total_partners_evaluated', v_evaluated,
    'total_partners_failed', v_failed,
    'excluded_by_reason', v_reasons,
    'top_exclusion_reason', v_top_reason,
    'top_exclusion_reason_count', COALESCE(v_top_reason_count,0),
    'reconciles', (v_found = v_eligible + v_excluded AND v_eligible = v_evaluated + v_failed),
    'status', v_recon_status,
    'note', v_recon_note);

  UPDATE public.expansion_rank_runs
     SET status='COMPLETED', pass_count=v_pass, total_partners=v_total,
         evaluated_partners=v_evaluated,
         promoted_partners=v_promoted, downgraded_partners=v_downgraded,
         unchanged_partners=v_unchanged, failed_partners=v_failed, finished_at=now(),
         metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('reconciliation', v_recon)
   WHERE id = v_run_id;

  RETURN jsonb_build_object('status','COMPLETED','mode',v_mode,'run_id',v_run_id,'reference',v_ref,
    'period_start',v_period_start,'period_end',v_period_end,'evaluated_as_of',v_as_of,
    'passes',v_pass,'total_partners',v_total,'promoted',v_promoted,'downgraded',v_downgraded,
    'unchanged',v_unchanged,'failed',v_failed,'reconciliation',v_recon,
    'config_snapshot',v_cfg,'results',v_results);
EXCEPTION WHEN OTHERS THEN
  IF v_run_id IS NOT NULL THEN
    BEGIN
      UPDATE public.expansion_rank_runs
         SET status='FAILED', finished_at=now(), error_summary=left(SQLERRM,500)
       WHERE id = v_run_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RAISE;
END; $function$;

-- =====================================================================
-- 3) ORQUESTRACAO: GATE DE CONCILIACAO + RESUMO ADMINISTRATIVO
-- =====================================================================
CREATE OR REPLACE FUNCTION public.expansion_run_weekly_orchestration(
  _period_start date DEFAULT NULL::date, _reference text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_recon jsonb := '{}'::jsonb;
  v_found int := 0; v_elig int := 0; v_excl int := 0; v_eval int := 0; v_fail int := 0;
  v_top text; v_recon_note text;
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

      -- gate de conciliacao automatica (HIGH)
      v_recon := COALESCE(v_res->'reconciliation','{}'::jsonb);
      IF COALESCE(v_recon->>'status','OK') <> 'OK' THEN
        PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_DRY_RUN','BLOCKED',
          jsonb_build_object('reconciliation',v_recon), COALESCE(v_recon->>'note','falha de conciliacao'));
        UPDATE public.expansion_orchestration_runs
           SET status='BLOCKED_INTEGRITY', current_stage='CAREER_DRY_RUN', finished_at=now(), next_retry_at=NULL,
               error_summary='conciliacao de parceiros: ' || COALESCE(v_recon->>'note','falha'),
               summary = COALESCE(summary,'{}'::jsonb) || jsonb_build_object('reconciliation',v_recon)
         WHERE id=v_run.id;
        PERFORM public.expansion_admin_alert(v_ref || ':alert:reconciliation',
          'Programa de Expansão requer atenção',
          'Período ' || to_char(v_period,'DD/MM/YYYY') || ' — etapa SIMULAÇÃO DE CARREIRA. Severidade: ALTA. ' ||
          'Problema: ' || COALESCE(v_recon->>'note','falha de conciliação de parceiros') ||
          ' Avaliação oficial bloqueada; nenhuma graduação alterada; fechamento financeiro preservado. ' ||
          'Automação Semanal: /dashboard?tab=expansion&secao=automacao');
        RETURN jsonb_build_object('status','BLOCKED_INTEGRITY','stage','CAREER_DRY_RUN','reconciliation',v_recon);
      END IF;

      PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_DRY_RUN','COMPLETED',
        jsonb_build_object('passes',v_res->'passes','total_partners',v_res->'total_partners',
          'promoted',v_res->'promoted','downgraded',v_res->'downgraded','unchanged',v_res->'unchanged',
          'reconciliation',v_recon));
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
      v_recon := COALESCE(v_res->'reconciliation', v_recon);

      IF COALESCE(v_recon->>'status','OK') <> 'OK' THEN
        PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_OFFICIAL','BLOCKED',
          jsonb_build_object('reconciliation',v_recon), COALESCE(v_recon->>'note','falha de conciliacao'));
        UPDATE public.expansion_orchestration_runs
           SET status='BLOCKED_INTEGRITY', current_stage='CAREER_OFFICIAL', finished_at=now(), next_retry_at=NULL,
               career_run_id=v_career_run,
               error_summary='conciliacao de parceiros: ' || COALESCE(v_recon->>'note','falha'),
               summary = COALESCE(summary,'{}'::jsonb) || jsonb_build_object('reconciliation',v_recon)
         WHERE id=v_run.id;
        PERFORM public.expansion_admin_alert(v_ref || ':alert:reconciliation_official',
          'Programa de Expansão requer atenção',
          'Período ' || to_char(v_period,'DD/MM/YYYY') || ' — etapa AVALIAÇÃO OFICIAL. Severidade: ALTA. ' ||
          'Problema: ' || COALESCE(v_recon->>'note','falha de conciliação de parceiros') ||
          ' Notificações suspensas; fechamento, carteira e graduações preservados. ' ||
          'Automação Semanal: /dashboard?tab=expansion&secao=automacao');
        RETURN jsonb_build_object('status','BLOCKED_INTEGRITY','stage','CAREER_OFFICIAL','reconciliation',v_recon);
      END IF;

      UPDATE public.expansion_orchestration_runs SET career_run_id=v_career_run WHERE id=v_run.id;
      PERFORM public.expansion_orch_stage_end(v_run.id,'CAREER_OFFICIAL','COMPLETED',
        jsonb_build_object('run_id',v_career_run,'status',v_res->>'status','promoted',v_promoted,
          'downgraded',v_downgraded,'unchanged',v_unchanged,'total_partners',v_partners,
          'reconciliation',v_recon));
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
    v_recon := COALESCE(v_st->'result_summary'->'reconciliation', v_recon);
  END IF;

  v_found := COALESCE((v_recon->>'total_partners_found')::int, v_partners);
  v_elig  := COALESCE((v_recon->>'total_partners_eligible')::int, v_partners);
  v_excl  := COALESCE((v_recon->>'total_partners_excluded')::int, 0);
  v_eval  := COALESCE((v_recon->>'total_partners_evaluated')::int, v_partners);
  v_fail  := COALESCE((v_recon->>'total_partners_failed')::int, 0);
  v_top   := COALESCE(v_recon->>'top_exclusion_reason','—');
  v_recon_note := COALESCE(v_recon->>'note','');

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
      '. Parceiros encontrados: ' || v_found ||
      '. Parceiros elegíveis: ' || v_elig ||
      '. Parceiros avaliados: ' || v_eval ||
      '. Parceiros excluídos: ' || v_excl ||
      '. Principal motivo de exclusão: ' || CASE WHEN v_excl = 0 THEN 'nenhum' ELSE v_top END ||
      '. Bônus liberado: R$ ' || public.expansion_fmt_br(v_rel_total,2) ||
      '. Promoções: ' || v_promoted || '. Rebaixamentos: ' || v_downgraded ||
      '. Status final: CONCLUÍDO' ||
      CASE WHEN v_recon_note = '' THEN '' ELSE '. ' || v_recon_note END ||
      ' Conclusão: ' || to_char(now() AT TIME ZONE 'America/Bahia','DD/MM/YYYY HH24:MI') || ' (Bahia).');
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
           'critical',v_crit,'high',v_high,'medium',v_med,'info',v_info,
           'partners_found',v_found,'partners_eligible',v_elig,'partners_excluded',v_excl,
           'partners_evaluated',v_eval,'partners_failed',v_fail,'top_exclusion_reason',v_top,
           'reconciliation',v_recon)
   WHERE id=v_run.id;

  RETURN jsonb_build_object('status',v_final,'period_start',v_period,'period_end',v_end,
    'run_id',v_run.id,'reference',v_ref,'close_run_id',v_close_run,'career_run_id',v_career_run,
    'partners',v_partners,'partners_with_bonus',v_with_bonus,'released_total',v_rel_total,
    'promoted',v_promoted,'downgraded',v_downgraded,'unchanged',v_unchanged,'notified',v_notified,
    'reconciliation',v_recon,
    'integrity',jsonb_build_object('critical',v_crit,'high',v_high,'medium',v_med,'info',v_info));
END; $function$;

-- =====================================================================
-- 4) CRON: JANELA EXATA 00:30..05:30 BAHIA (03:30..08:30 UTC)
-- =====================================================================
DO $do$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobname FROM cron.job
            WHERE jobname IN ('expansion-orchestration-recovery',
                              'expansion-orchestration-recovery-30',
                              'expansion-orchestration-recovery-00',
                              'expansion-orchestration-recovery-daily') LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $do$;

-- 03:30, 04:30, 05:30, 06:30, 07:30, 08:30 UTC
SELECT cron.schedule('expansion-orchestration-recovery-30', '30 3-8 * * 1',
  $$SELECT public.expansion_recover_weekly_orchestration(true);$$);
-- 04:00, 05:00, 06:00, 07:00, 08:00 UTC
SELECT cron.schedule('expansion-orchestration-recovery-00', '0 4-8 * * 1',
  $$SELECT public.expansion_recover_weekly_orchestration(true);$$);
-- verificacao diaria 03:40 Bahia = 06:40 UTC (fora da janela semanal, sem validacao de janela)
SELECT cron.schedule('expansion-orchestration-recovery-daily', '40 6 * * *',
  $$SELECT public.expansion_recover_weekly_orchestration(false);$$);