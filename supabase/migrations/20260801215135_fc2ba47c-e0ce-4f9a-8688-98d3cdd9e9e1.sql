-- ============================================================
-- ETAPA B - MOTOR OFICIAL DE AVALIACAO DE CARREIRA (desativado)
-- ============================================================

-- 1. FLAGS -----------------------------------------------------
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES
  ('expansion_career_evaluation_enabled','false','boolean','Ativa o motor oficial de avaliacao de carreira do Programa de Expansao'),
  ('expansion_career_notifications_enabled','false','boolean','Ativa notificacoes de mudanca de graduacao de carreira')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. HISTORICO: colunas adicionais ------------------------------
ALTER TABLE public.expansion_rank_evaluations
  ADD COLUMN IF NOT EXISTS evaluated_as_of timestamptz,
  ADD COLUMN IF NOT EXISTS config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS run_id uuid,
  ADD COLUMN IF NOT EXISTS distinct_leader_teams integer NOT NULL DEFAULT 0;

-- 3. TABELA DE EXECUCOES ----------------------------------------
CREATE TABLE IF NOT EXISTS public.expansion_rank_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_reference text NOT NULL UNIQUE,
  run_type text NOT NULL DEFAULT 'WEEKLY',
  period_start date,
  period_end date,
  evaluated_as_of timestamptz NOT NULL,
  mode text NOT NULL DEFAULT 'DRY_RUN',
  status text NOT NULL DEFAULT 'PENDING',
  config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_partners integer NOT NULL DEFAULT 0,
  evaluated_partners integer NOT NULL DEFAULT 0,
  promoted_partners integer NOT NULL DEFAULT 0,
  downgraded_partners integer NOT NULL DEFAULT 0,
  unchanged_partners integer NOT NULL DEFAULT 0,
  failed_partners integer NOT NULL DEFAULT 0,
  pass_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  triggered_by uuid,
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expansion_rank_runs_mode_chk CHECK (mode IN ('DRY_RUN','OFFICIAL')),
  CONSTRAINT expansion_rank_runs_status_chk CHECK (status IN ('PENDING','PROCESSING','COMPLETED','PARTIAL_FAILURE','FAILED','SKIPPED_DISABLED'))
);

GRANT SELECT ON public.expansion_rank_runs TO authenticated;
GRANT ALL ON public.expansion_rank_runs TO service_role;
ALTER TABLE public.expansion_rank_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_rank_runs" ON public.expansion_rank_runs;
CREATE POLICY "admins_read_rank_runs" ON public.expansion_rank_runs
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- 4. NUCLEO: LEDGER COM CORTE TEMPORAL ---------------------------
CREATE OR REPLACE FUNCTION public.expansion_career_ledger_net_rows_as_of(_as_of timestamptz)
RETURNS TABLE(ledger_id uuid, user_id uuid, contract_id uuid, plan_name_canonical text,
              classification text, gross_points numeric, reversed_points numeric, net_points numeric,
              reversal_count integer, event_created_at timestamptz, source_type text,
              source_id uuid, source_ref text, is_fully_reversed boolean, has_reversal_anomaly boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT public.expansion_effective_cutoff() AS cutoff_at,
           COALESCE((SELECT NULLIF(BTRIM(setting_value), '')::jsonb
                       FROM public.system_settings
                      WHERE setting_key = 'expansion_prelaunch_authorized_ledger_ids'), '[]'::jsonb) AS authorized_ids
  ),
  cls AS (
    SELECT l.id, l.user_id, l.contract_id,
           public.expansion_normalize_plan_name(l.plan_name) AS plan_name_canonical,
           COALESCE(l.points, 0)::numeric AS points,
           l.source, l.source_ref, l.created_at, l.reverses_id,
           CASE
             WHEN l.reverses_id IS NOT NULL THEN 'REVERSAL'
             WHEN l.status <> 'CONFIRMED' THEN 'INVALID'
             WHEN COALESCE(l.points, 0) <= 0 THEN 'INVALID'
             WHEN c.is_demo IS TRUE THEN 'INVALID'
             WHEN cfg.cutoff_at IS NOT NULL AND l.created_at < cfg.cutoff_at
                  AND cfg.authorized_ids ? l.id::text THEN 'PRELAUNCH_AUTHORIZED'
             WHEN cfg.cutoff_at IS NOT NULL AND l.created_at < cfg.cutoff_at THEN 'PRELAUNCH_UNAUTHORIZED'
             ELSE 'OFFICIAL'
           END AS classification
      FROM public.expansion_points_ledger l
      CROSS JOIN cfg
      LEFT JOIN public.partner_contracts c ON c.id = l.contract_id
     WHERE l.created_at <= _as_of
  ),
  rev AS (
    SELECT r.reverses_id AS original_id,
           SUM(ABS(r.points))::numeric AS reversed_points,
           COUNT(*)::integer AS reversal_count
      FROM cls r
      JOIN cls o ON o.id = r.reverses_id
     WHERE r.classification = 'REVERSAL'
       AND o.classification IN ('OFFICIAL','PRELAUNCH_AUTHORIZED')
     GROUP BY r.reverses_id
  )
  SELECT e.id, e.user_id, e.contract_id, e.plan_name_canonical, e.classification,
         e.points, COALESCE(rev.reversed_points,0),
         GREATEST(e.points - COALESCE(rev.reversed_points,0), 0),
         COALESCE(rev.reversal_count,0), e.created_at, e.source,
         CASE WHEN e.source_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN e.source_ref::uuid ELSE NULL END,
         e.source_ref,
         (COALESCE(rev.reversed_points,0) >= e.points),
         (COALESCE(rev.reversed_points,0) > e.points)
    FROM cls e
    LEFT JOIN rev ON rev.original_id = e.id
   WHERE e.classification IN ('OFFICIAL','PRELAUNCH_AUTHORIZED')
$function$;

-- 5. PONTOS POR EQUIPE COM CORTE TEMPORAL (interno) --------------
CREATE OR REPLACE FUNCTION public.expansion_career_points_by_team_as_of(_user_id uuid, _as_of timestamptz)
RETURNS TABLE(ancestor_user_id uuid, team_root_user_id uuid, team_public_name text,
              gross_career_points numeric, reversed_career_points numeric, net_career_points numeric,
              real_active_partner_count integer, is_qualified_team boolean,
              share_of_total_percent numeric, first_valid_event_at timestamptz, last_valid_event_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH params AS (
    SELECT COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::integer FROM public.system_settings
                      WHERE setting_key='expansion_min_active_partners_per_team'),1) AS min_active,
           COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::numeric FROM public.system_settings
                      WHERE setting_key='expansion_min_qualified_team_points'),0) AS min_points
  ),
  net AS (SELECT * FROM public.expansion_career_ledger_net_rows_as_of(_as_of)),
  ev AS (
    SELECT m.team_root_user_id AS root_id,
           SUM(n.gross_points)::numeric AS gross_points,
           SUM(n.reversed_points)::numeric AS reversed_points,
           SUM(n.net_points)::numeric AS net_points,
           MIN(n.event_created_at) AS first_at,
           MAX(n.event_created_at) AS last_at
      FROM net n
      JOIN public.expansion_team_memberships m
        ON m.ancestor_user_id = _user_id
       AND m.descendant_user_id = n.user_id
       AND m.effective_from <= _as_of
       AND n.event_created_at >= m.effective_from
       AND (m.effective_to IS NULL OR n.event_created_at < m.effective_to)
     GROUP BY m.team_root_user_id
  ),
  act AS (
    SELECT m.team_root_user_id AS root_id, COUNT(DISTINCT c.user_id)::integer AS partners
      FROM public.expansion_team_memberships m
      JOIN public.partner_contracts c
        ON c.user_id = m.descendant_user_id
       AND c.status = 'ACTIVE'
       AND c.is_demo IS NOT TRUE
       AND c.created_at <= _as_of
      LEFT JOIN public.profiles p ON p.user_id = c.user_id
     WHERE m.ancestor_user_id = _user_id
       AND m.effective_from <= _as_of
       AND (m.effective_to IS NULL OR m.effective_to > _as_of)
       AND COALESCE(p.is_bot,false) = false
       AND COALESCE(p.is_test_account,false) = false
     GROUP BY m.team_root_user_id
  ),
  base AS (
    SELECT COALESCE(ev.root_id, act.root_id) AS root_id,
           COALESCE(ev.gross_points,0) AS gross_points,
           COALESCE(ev.reversed_points,0) AS reversed_points,
           COALESCE(ev.net_points,0) AS net_points,
           COALESCE(act.partners,0) AS partners,
           ev.first_at, ev.last_at
      FROM ev FULL JOIN act ON act.root_id = ev.root_id
  ),
  tot AS (SELECT NULLIF(SUM(b.net_points),0) AS total FROM base b),
  named AS (
    SELECT b.*, ROW_NUMBER() OVER (ORDER BY b.net_points DESC, b.root_id) AS rn, p.full_name
      FROM base b LEFT JOIN public.profiles p ON p.user_id = b.root_id
  )
  SELECT _user_id, nm.root_id,
         CASE
           WHEN NULLIF(BTRIM(COALESCE(nm.full_name,'')),'') IS NULL THEN 'Equipe ' || nm.rn::text
           WHEN POSITION(' ' IN BTRIM(nm.full_name)) > 0
             THEN SPLIT_PART(BTRIM(nm.full_name),' ',1) || ' ' ||
                  UPPER(LEFT(SPLIT_PART(BTRIM(nm.full_name),' ',2),1)) || '.'
           ELSE BTRIM(nm.full_name)
         END,
         nm.gross_points, nm.reversed_points, nm.net_points, nm.partners,
         (nm.net_points > 0 AND nm.net_points >= (SELECT min_points FROM params)
          AND nm.partners >= (SELECT min_active FROM params)),
         ROUND(COALESCE(nm.net_points / (SELECT total FROM tot),0) * 100, 2),
         nm.first_at, nm.last_at
    FROM named nm
   ORDER BY nm.net_points DESC, nm.root_id
$function$;

CREATE OR REPLACE FUNCTION public.expansion_career_points_as_of(_user_id uuid, _as_of timestamptz)
RETURNS TABLE(user_id uuid, gross_career_points numeric, reversed_career_points numeric,
              net_career_points numeric, teams_with_positive_points integer, qualified_teams integer,
              largest_team_points numeric, other_teams_points numeric, largest_team_share_percent numeric,
              calculated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH t AS (SELECT * FROM public.expansion_career_points_by_team_as_of(_user_id, _as_of)),
  agg AS (
    SELECT COALESCE(SUM(t.gross_career_points),0)::numeric AS gross_pts,
           COALESCE(SUM(t.reversed_career_points),0)::numeric AS rev_pts,
           COALESCE(SUM(t.net_career_points),0)::numeric AS net_pts,
           COUNT(*) FILTER (WHERE t.net_career_points > 0)::integer AS teams_pos,
           COUNT(*) FILTER (WHERE t.is_qualified_team)::integer AS teams_qual,
           COALESCE(MAX(t.net_career_points),0)::numeric AS largest
      FROM t)
  SELECT _user_id, agg.gross_pts, agg.rev_pts, agg.net_pts, agg.teams_pos, agg.teams_qual,
         agg.largest, GREATEST(agg.net_pts - agg.largest, 0),
         CASE WHEN agg.net_pts > 0 THEN ROUND(agg.largest/agg.net_pts*100,2) ELSE 0 END,
         now()
    FROM agg
$function$;

-- 6. LIDERES ELEGIVEIS COM CONTEXTO E CORTE -----------------------
CREATE OR REPLACE FUNCTION public.expansion_eligible_leaders_ctx(
  _user_id uuid, _min_rank text, _as_of timestamptz, _rank_context jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(leader_user_id uuid, team_root_user_id uuid, leader_rank text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (m.descendant_user_id)
         m.descendant_user_id, m.team_root_user_id,
         COALESCE(_rank_context->>m.descendant_user_id::text, r.current_rank, 'NONE') AS leader_rank
    FROM public.expansion_team_memberships m
    LEFT JOIN public.expansion_partner_ranks r ON r.user_id = m.descendant_user_id
   WHERE m.ancestor_user_id = _user_id
     AND m.descendant_user_id <> _user_id
     AND m.effective_from <= _as_of
     AND (m.effective_to IS NULL OR m.effective_to > _as_of)
     AND _min_rank IS NOT NULL
     AND public.expansion_rank_order(COALESCE(_rank_context->>m.descendant_user_id::text, r.current_rank, 'NONE')) >= public.expansion_rank_order(_min_rank)
     AND COALESCE(_rank_context->>m.descendant_user_id::text, r.current_rank, 'NONE') <> 'NONE'
   ORDER BY m.descendant_user_id,
            public.expansion_rank_order(COALESCE(_rank_context->>m.descendant_user_id::text, r.current_rank, 'NONE')) DESC
$function$;

-- 7. NUCLEO CANONICO ---------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_career_config_snapshot()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'generated_at', now(),
    'min_active_partners_per_team', COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::integer FROM public.system_settings WHERE setting_key='expansion_min_active_partners_per_team'),1),
    'min_qualified_team_points', COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::numeric FROM public.system_settings WHERE setting_key='expansion_min_qualified_team_points'),0),
    'ranks', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'rank_key', c.rank_key, 'sort_order', c.sort_order,
        'min_organizational_points', c.min_organizational_points,
        'min_qualified_teams', c.min_qualified_teams,
        'max_team_concentration_pct', c.max_team_concentration_pct,
        'required_leaders', c.required_leaders) ORDER BY c.sort_order)
      FROM public.expansion_career_config c WHERE c.is_active), '[]'::jsonb),
    'config_hash', md5(COALESCE((SELECT string_agg(c.rank_key||':'||c.sort_order||':'||c.min_organizational_points||':'||c.min_qualified_teams||':'||c.max_team_concentration_pct||':'||COALESCE(c.required_leaders::text,''), '|' ORDER BY c.sort_order)
      FROM public.expansion_career_config c WHERE c.is_active),''))
  )
$function$;

CREATE OR REPLACE FUNCTION public.expansion_compute_career_state(
  _user_id uuid,
  _evaluated_as_of timestamptz DEFAULT now(),
  _rank_context jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_totals record; v_cfg record; v_req jsonb; v_req_rank text;
  v_req_count integer; v_distinct boolean; v_max_countable numeric;
  v_qualified_points numeric; v_qualified_teams integer;
  v_leaders integer; v_distinct_teams integer;
  v_pending jsonb; v_criteria jsonb; v_met boolean;
  v_ranks jsonb := '[]'::jsonb; v_diagnosed text := 'NONE';
  v_best jsonb := NULL; v_ctx jsonb := COALESCE(_rank_context, '{}'::jsonb);
BEGIN
  SELECT * INTO v_totals FROM public.expansion_career_points_as_of(_user_id, _evaluated_as_of);
  SELECT count(*) FILTER (WHERE is_qualified_team) INTO v_qualified_teams
    FROM public.expansion_career_points_by_team_as_of(_user_id, _evaluated_as_of);

  FOR v_cfg IN SELECT * FROM public.expansion_career_config WHERE is_active ORDER BY sort_order DESC LOOP
    v_max_countable := v_cfg.min_organizational_points * (v_cfg.max_team_concentration_pct / 100.0);

    SELECT COALESCE(sum(LEAST(t.net_career_points, v_max_countable)),0) INTO v_qualified_points
      FROM public.expansion_career_points_by_team_as_of(_user_id, _evaluated_as_of) t
     WHERE t.net_career_points > 0;

    v_req := CASE WHEN jsonb_array_length(COALESCE(v_cfg.required_leaders,'[]'::jsonb)) > 0
                  THEN v_cfg.required_leaders->0 ELSE NULL END;
    v_req_rank := CASE WHEN v_req IS NULL OR jsonb_typeof(v_req->'rank')='null' THEN NULL ELSE v_req->>'rank' END;
    v_req_count := COALESCE((v_req->>'count')::integer, 0);
    v_distinct := COALESCE((v_req->>'distinct_teams')::boolean, false);

    v_leaders := 0; v_distinct_teams := 0;
    IF v_req_rank IS NOT NULL THEN
      SELECT count(*)::int, count(DISTINCT l.team_root_user_id)::int
        INTO v_leaders, v_distinct_teams
        FROM public.expansion_eligible_leaders_ctx(_user_id, v_req_rank, _evaluated_as_of, v_ctx) l;
    END IF;

    v_pending := '[]'::jsonb;
    IF COALESCE(v_totals.net_career_points,0) < v_cfg.min_organizational_points THEN
      v_pending := v_pending || to_jsonb('PONTOS_BRUTOS_INSUFICIENTES'::text); END IF;
    IF v_qualified_points < v_cfg.min_organizational_points THEN
      v_pending := v_pending || to_jsonb('PONTOS_CONTAVEIS_APOS_CONCENTRACAO_INSUFICIENTES'::text); END IF;
    IF v_qualified_teams < v_cfg.min_qualified_teams THEN
      v_pending := v_pending || to_jsonb('EQUIPES_QUALIFICADAS_INSUFICIENTES'::text); END IF;
    IF v_req_rank IS NOT NULL THEN
      IF v_leaders < v_req_count THEN
        v_pending := v_pending || to_jsonb('LIDERES_INSUFICIENTES'::text); END IF;
      IF v_distinct AND v_distinct_teams < v_req_count THEN
        v_pending := v_pending || to_jsonb('LIDERES_EM_EQUIPES_DISTINTAS_INSUFICIENTES'::text); END IF;
    END IF;

    v_criteria := jsonb_build_object(
      'points_gross', jsonb_build_object('required', v_cfg.min_organizational_points,
        'current', COALESCE(v_totals.net_career_points,0),
        'met', COALESCE(v_totals.net_career_points,0) >= v_cfg.min_organizational_points),
      'points_countable', jsonb_build_object('required', v_cfg.min_organizational_points,
        'current', v_qualified_points, 'met', v_qualified_points >= v_cfg.min_organizational_points),
      'concentration', jsonb_build_object('max_team_concentration_percent', v_cfg.max_team_concentration_pct,
        'maximum_countable_from_one_team', v_max_countable,
        'largest_team_share_percent', COALESCE(v_totals.largest_team_share_percent,0)),
      'qualified_teams', jsonb_build_object('required', v_cfg.min_qualified_teams,
        'current', v_qualified_teams, 'met', v_qualified_teams >= v_cfg.min_qualified_teams),
      'leaders', CASE WHEN v_req_rank IS NULL THEN jsonb_build_object('applicable', false)
        ELSE jsonb_build_object('applicable', true, 'required_rank', v_req_rank,
          'required_count', v_req_count, 'current_count', v_leaders,
          'met', v_leaders >= v_req_count) END,
      'leader_distinct_teams', CASE WHEN v_req_rank IS NULL OR NOT v_distinct
        THEN jsonb_build_object('applicable', false)
        ELSE jsonb_build_object('applicable', true, 'required', v_req_count,
          'current', v_distinct_teams, 'met', v_distinct_teams >= v_req_count) END);

    v_met := (jsonb_array_length(v_pending) = 0);

    v_ranks := v_ranks || jsonb_build_object(
      'rank_key', v_cfg.rank_key, 'sort_order', v_cfg.sort_order,
      'required_points', v_cfg.min_organizational_points,
      'max_team_concentration_percent', v_cfg.max_team_concentration_pct,
      'maximum_countable_from_one_team', v_max_countable,
      'qualified_rank_points', v_qualified_points,
      'required_qualified_teams', v_cfg.min_qualified_teams,
      'current_qualified_teams', v_qualified_teams,
      'required_leader_rank', v_req_rank, 'required_leader_count', v_req_count,
      'requires_distinct_leader_teams', v_distinct,
      'eligible_leader_count', v_leaders, 'distinct_leader_teams', v_distinct_teams,
      'criteria', v_criteria, 'requirements_met', v_met, 'requirements_pending', v_pending);

    IF v_met AND v_diagnosed = 'NONE' THEN
      v_diagnosed := v_cfg.rank_key;
      v_best := jsonb_build_object('qualified_rank_points', v_qualified_points,
                                   'eligible_leaders', v_leaders,
                                   'distinct_leader_teams', v_distinct_teams,
                                   'requirements_pending', v_pending);
    END IF;
  END LOOP;

  IF v_best IS NULL THEN
    v_best := jsonb_build_object(
      'qualified_rank_points', COALESCE((SELECT (r->>'qualified_rank_points')::numeric FROM jsonb_array_elements(v_ranks) r
                                          ORDER BY (r->>'sort_order')::int ASC LIMIT 1),0),
      'eligible_leaders', COALESCE((SELECT (r->>'eligible_leader_count')::int FROM jsonb_array_elements(v_ranks) r
                                     ORDER BY (r->>'sort_order')::int ASC LIMIT 1),0),
      'distinct_leader_teams', COALESCE((SELECT (r->>'distinct_leader_teams')::int FROM jsonb_array_elements(v_ranks) r
                                     ORDER BY (r->>'sort_order')::int ASC LIMIT 1),0),
      'requirements_pending', COALESCE((SELECT r->'requirements_pending' FROM jsonb_array_elements(v_ranks) r
                                     ORDER BY (r->>'sort_order')::int ASC LIMIT 1),'[]'::jsonb));
  END IF;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'evaluated_as_of', _evaluated_as_of,
    'diagnosed_rank', v_diagnosed,
    'gross_career_points', COALESCE(v_totals.gross_career_points,0),
    'reversed_career_points', COALESCE(v_totals.reversed_career_points,0),
    'net_career_points', COALESCE(v_totals.net_career_points,0),
    'total_teams_with_points', COALESCE(v_totals.teams_with_positive_points,0),
    'qualified_teams', v_qualified_teams,
    'largest_team_points', COALESCE(v_totals.largest_team_points,0),
    'largest_team_share_percent', COALESCE(v_totals.largest_team_share_percent,0),
    'qualified_rank_points', (v_best->>'qualified_rank_points')::numeric,
    'eligible_leaders', (v_best->>'eligible_leaders')::int,
    'distinct_leader_teams', (v_best->>'distinct_leader_teams')::int,
    'requirements_pending', v_best->'requirements_pending',
    'requirements_met', (v_diagnosed <> 'NONE'),
    'ranks', v_ranks,
    'calculated_at', now());
END; $function$;

-- 8. PREVIEW (somente leitura) reusa o nucleo ---------------------
CREATE OR REPLACE FUNCTION public.expansion_preview_career(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_state jsonb; v_cur text := 'NONE'; v_high text := 'NONE'; v_next text; v_reg record;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.is_admin_user(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT current_rank, highest_rank_ever INTO v_reg
    FROM public.expansion_partner_ranks WHERE user_id = _user_id;
  IF FOUND THEN v_cur := v_reg.current_rank; v_high := v_reg.highest_rank_ever; END IF;

  v_state := public.expansion_compute_career_state(_user_id, now(), '{}'::jsonb);

  SELECT rank_key INTO v_next FROM public.expansion_career_config
   WHERE is_active AND sort_order > COALESCE(
     (SELECT sort_order FROM public.expansion_career_config WHERE rank_key = v_cur), 0)
   ORDER BY sort_order ASC LIMIT 1;

  RETURN v_state || jsonb_build_object(
    'registered_current_rank', v_cur,
    'highest_rank_ever', v_high,
    'next_rank', v_next);
END; $function$;

-- 9. AVALIACAO OFICIAL INDIVIDUAL (interna) -----------------------
CREATE OR REPLACE FUNCTION public.expansion_evaluate_career_internal(
  _user_id uuid,
  _evaluation_reference text,
  _source_type text,
  _source_id uuid,
  _evaluated_as_of timestamptz,
  _run_id uuid,
  _calculated_rank_context jsonb DEFAULT '{}'::jsonb,
  _config_snapshot jsonb DEFAULT '{}'::jsonb,
  _evaluated_by uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_state jsonb; v_new text; v_prev text := 'NONE'; v_high_before text := 'NONE';
  v_high_after text; v_reg record; v_eval_id uuid; v_changed boolean;
BEGIN
  -- idempotencia por user_id + evaluation_reference
  SELECT id INTO v_eval_id FROM public.expansion_rank_evaluations
   WHERE user_id = _user_id AND evaluation_reference = _evaluation_reference;
  IF v_eval_id IS NOT NULL THEN
    RETURN jsonb_build_object('status','ALREADY_PROCESSED','evaluation_id',v_eval_id,'user_id',_user_id);
  END IF;

  SELECT * INTO v_reg FROM public.expansion_partner_ranks WHERE user_id = _user_id FOR UPDATE;
  IF FOUND THEN
    v_prev := COALESCE(v_reg.current_rank,'NONE');
    v_high_before := COALESCE(v_reg.highest_rank_ever,'NONE');
  END IF;

  IF _calculated_rank_context ? _user_id::text THEN
    v_new := _calculated_rank_context->>_user_id::text;
    v_state := public.expansion_compute_career_state(_user_id, _evaluated_as_of, _calculated_rank_context);
  ELSE
    v_state := public.expansion_compute_career_state(_user_id, _evaluated_as_of, _calculated_rank_context);
    v_new := v_state->>'diagnosed_rank';
  END IF;

  v_changed := (v_new IS DISTINCT FROM v_prev);
  v_high_after := CASE WHEN public.expansion_rank_order(v_new) > public.expansion_rank_order(v_high_before)
                       THEN v_new ELSE v_high_before END;

  INSERT INTO public.expansion_rank_evaluations (
    user_id, previous_rank, evaluated_rank, highest_rank_before, highest_rank_after,
    evaluation_reference, source_type, source_id,
    gross_career_points, reversed_career_points, net_career_points, qualified_rank_points,
    qualified_teams, largest_team_share_percent, eligible_leaders, distinct_leader_teams,
    requirements_met, requirements_pending, evaluated_at, evaluated_by,
    config_snapshot, evaluated_as_of, run_id)
  VALUES (
    _user_id, v_prev, v_new, v_high_before, v_high_after,
    _evaluation_reference, COALESCE(_source_type,'MANUAL'), _source_id,
    (v_state->>'gross_career_points')::numeric, (v_state->>'reversed_career_points')::numeric,
    (v_state->>'net_career_points')::numeric, (v_state->>'qualified_rank_points')::numeric,
    (v_state->>'qualified_teams')::integer, (v_state->>'largest_team_share_percent')::numeric,
    (v_state->>'eligible_leaders')::integer, (v_state->>'distinct_leader_teams')::integer,
    (v_state->>'requirements_met')::boolean, COALESCE(v_state->'requirements_pending','[]'::jsonb),
    now(), _evaluated_by, COALESCE(_config_snapshot,'{}'::jsonb), _evaluated_as_of, _run_id)
  RETURNING id INTO v_eval_id;

  IF v_reg.user_id IS NULL THEN
    INSERT INTO public.expansion_partner_ranks (
      user_id, current_rank, current_rank_since, highest_rank_ever, highest_rank_at,
      last_evaluated_at, last_evaluation_reference)
    VALUES (_user_id, v_new, now(), v_high_after,
            CASE WHEN v_high_after <> 'NONE' THEN now() ELSE NULL END,
            now(), _evaluation_reference);
  ELSE
    UPDATE public.expansion_partner_ranks r
       SET current_rank = v_new,
           current_rank_since = CASE WHEN v_changed THEN now() ELSE r.current_rank_since END,
           highest_rank_ever = v_high_after,
           highest_rank_at = CASE WHEN public.expansion_rank_order(v_high_after) > public.expansion_rank_order(v_high_before)
                                  THEN now() ELSE r.highest_rank_at END,
           last_evaluated_at = now(),
           last_evaluation_reference = _evaluation_reference
     WHERE r.user_id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN NOT v_changed THEN 'UNCHANGED'
                   WHEN public.expansion_rank_order(v_new) > public.expansion_rank_order(v_prev) THEN 'PROMOTED'
                   ELSE 'DOWNGRADED' END,
    'evaluation_id', v_eval_id, 'user_id', _user_id,
    'previous_rank', v_prev, 'evaluated_rank', v_new,
    'highest_rank_ever', v_high_after);
END; $function$;

-- 10. NOTIFICACAO DE GRADUACAO (preparada, desativada) -------------
CREATE OR REPLACE FUNCTION public.expansion_notify_rank_change(_evaluation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v public.expansion_rank_evaluations%ROWTYPE;
  v_enabled boolean;
  v_title text; v_msg text; v_ref text; v_type text;
BEGIN
  v_enabled := COALESCE((SELECT NULLIF(BTRIM(setting_value),'')::boolean FROM public.system_settings
                          WHERE setting_key='expansion_career_notifications_enabled'), false);
  IF NOT v_enabled THEN RETURN; END IF;

  SELECT * INTO v FROM public.expansion_rank_evaluations WHERE id = _evaluation_id;
  IF NOT FOUND OR v.evaluated_rank IS NOT DISTINCT FROM v.previous_rank THEN RETURN; END IF;

  v_ref := 'expansion_rank_notification:' || _evaluation_id::text;
  IF EXISTS (SELECT 1 FROM public.notifications
              WHERE user_id = v.user_id AND metadata->>'ref' = v_ref) THEN RETURN; END IF;

  IF public.expansion_rank_order(v.evaluated_rank) > public.expansion_rank_order(v.previous_rank) THEN
    v_type := 'expansion_rank_promotion';
    v_title := 'Parabéns pela nova graduação!';
    v_msg := 'Você alcançou a graduação ' || v.evaluated_rank ||
             ' no Programa de Expansão. Consulte seu progresso e os próximos requisitos na área de carreira.';
  ELSE
    v_type := 'expansion_rank_update';
    v_title := 'Atualização da sua graduação';
    v_msg := 'Sua graduação atual no Programa de Expansão foi atualizada para ' || v.evaluated_rank ||
             '. Sua maior graduação histórica permanece registrada. Consulte os critérios atuais na área de carreira.';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (v.user_id, v_type, v_title, v_msg, '/minha-parceria?tab=expansion&secao=carreira',
          jsonb_build_object('ref', v_ref, 'evaluation_id', _evaluation_id,
                             'previous_rank', v.previous_rank, 'evaluated_rank', v.evaluated_rank));
END; $function$;

-- 11. LOTE: BOTTOM-UP + ESTABILIZACAO ------------------------------
CREATE OR REPLACE FUNCTION public.expansion_run_career_evaluation(
  _period_start date DEFAULT NULL,
  _mode text DEFAULT 'DRY_RUN',
  _reference text DEFAULT NULL,
  _evaluated_as_of timestamptz DEFAULT NULL,
  _triggered_by uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  -- parceiros elegiveis, ordenados bottom-up (altura da subarvore ascendente)
  CREATE TEMP TABLE IF NOT EXISTS _career_batch (user_id uuid PRIMARY KEY, height integer) ON COMMIT DROP;
  DELETE FROM _career_batch;

  INSERT INTO _career_batch (user_id, height)
  SELECT c.user_id,
         COALESCE((SELECT MAX(m.depth) FROM public.expansion_team_memberships m
                    WHERE m.ancestor_user_id = c.user_id
                      AND m.effective_from <= v_as_of
                      AND (m.effective_to IS NULL OR m.effective_to > v_as_of)), 0)
    FROM public.partner_contracts c
    LEFT JOIN public.profiles p ON p.user_id = c.user_id
   WHERE c.status = 'ACTIVE' AND c.is_demo IS NOT TRUE
     AND c.created_at <= v_as_of
     AND COALESCE(p.is_bot,false) = false
     AND COALESCE(p.is_test_account,false) = false
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO _career_batch (user_id, height)
  SELECT r.user_id, 0 FROM public.expansion_partner_ranks r
  ON CONFLICT (user_id) DO NOTHING;

  SELECT count(*) INTO v_total FROM _career_batch;

  -- passes de estabilizacao
  WHILE v_pass < v_max_passes AND NOT v_stable LOOP
    v_pass := v_pass + 1;
    v_prev_ctx := v_ctx;
    FOR v_u IN SELECT user_id FROM _career_batch ORDER BY height ASC, user_id ASC LOOP
      v_state := public.expansion_compute_career_state(v_u.user_id, v_as_of, v_ctx);
      v_rank := v_state->>'diagnosed_rank';
      v_ctx := jsonb_set(v_ctx, ARRAY[v_u.user_id::text], to_jsonb(v_rank), true);
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

    IF (v_res->>'status') = 'PROMOTED' THEN v_promoted := v_promoted + 1;
    ELSIF (v_res->>'status') = 'DOWNGRADED' THEN v_downgraded := v_downgraded + 1;
    ELSE v_unchanged := v_unchanged + 1; END IF;

    v_results := v_results || v_res;
  END LOOP;

  UPDATE public.expansion_rank_runs
     SET status='COMPLETED', pass_count=v_pass, total_partners=v_total,
         evaluated_partners=v_promoted+v_downgraded+v_unchanged,
         promoted_partners=v_promoted, downgraded_partners=v_downgraded,
         unchanged_partners=v_unchanged, finished_at=now()
   WHERE id = v_run_id;

  RETURN jsonb_build_object('status','COMPLETED','mode',v_mode,'run_id',v_run_id,'reference',v_ref,
    'period_start',v_period_start,'period_end',v_period_end,'evaluated_as_of',v_as_of,
    'passes',v_pass,'total_partners',v_total,'promoted',v_promoted,'downgraded',v_downgraded,
    'unchanged',v_unchanged,'config_snapshot',v_cfg,'results',v_results);
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

-- 12. WRAPPER ADMINISTRATIVO ---------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_evaluate_career(
  _user_id uuid DEFAULT NULL,
  _mode text DEFAULT 'DRY_RUN',
  _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_mode text := upper(COALESCE(_mode,'DRY_RUN'));
  v_ref text := 'career:admin:' || gen_random_uuid()::text;
  v_res jsonb;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_mode NOT IN ('DRY_RUN','OFFICIAL') THEN RAISE EXCEPTION 'modo invalido'; END IF;
  IF v_mode = 'OFFICIAL' AND NULLIF(BTRIM(COALESCE(_reason,'')),'') IS NULL THEN
    RAISE EXCEPTION 'motivo obrigatorio no modo oficial';
  END IF;

  v_res := public.expansion_run_career_evaluation(NULL, v_mode, v_ref, now(), auth.uid());

  IF _user_id IS NOT NULL THEN
    v_res := v_res || jsonb_build_object('focus_user',
      COALESCE((SELECT r FROM jsonb_array_elements(COALESCE(v_res->'results','[]'::jsonb)) r
                 WHERE r->>'user_id' = _user_id::text LIMIT 1), 'null'::jsonb));
  END IF;

  INSERT INTO public.expansion_admin_audit (admin_id, action, target_type, target_id, reason, before_value, after_value)
  VALUES (auth.uid(), 'career_evaluation_' || lower(v_mode), 'career_run', _user_id, _reason,
          '{}'::jsonb, jsonb_build_object('reference', v_ref, 'status', v_res->>'status',
            'promoted', v_res->'promoted', 'downgraded', v_res->'downgraded'));

  RETURN v_res;
END; $function$;

-- 13. SEGURANCA -----------------------------------------------------
REVOKE ALL ON FUNCTION public.expansion_career_ledger_net_rows_as_of(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_career_points_by_team_as_of(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_career_points_as_of(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_eligible_leaders_ctx(uuid, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_compute_career_state(uuid, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_evaluate_career_internal(uuid, text, text, uuid, timestamptz, uuid, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_run_career_evaluation(date, text, text, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_notify_rank_change(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_career_config_snapshot() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.expansion_admin_evaluate_career(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_preview_career(uuid) TO authenticated;

-- indices
CREATE UNIQUE INDEX IF NOT EXISTS ux_rank_eval_user_reference
  ON public.expansion_rank_evaluations (user_id, evaluation_reference);
CREATE INDEX IF NOT EXISTS ix_rank_eval_run ON public.expansion_rank_evaluations (run_id);
CREATE INDEX IF NOT EXISTS ix_rank_runs_ref ON public.expansion_rank_runs (run_reference);