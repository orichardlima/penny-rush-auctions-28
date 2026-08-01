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
                    WHERE (m.descendant_user_id = u.user_id OR m.ancestor_user_id = u.user_id)
                      AND m.effective_from <= v_as_of
                      AND (m.effective_to IS NULL OR m.effective_to > v_as_of)) AS has_position
      FROM universe u
  )
  SELECT c.user_id,
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