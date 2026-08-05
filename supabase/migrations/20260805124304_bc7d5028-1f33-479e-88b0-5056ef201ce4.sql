-- =====================================================================
-- CONFIGURAÇÃO VERSIONADA DE CARREIRA + PREVIEW BOTTOM-UP REAL
-- =====================================================================

-- ---------------------------------------------------------------
-- VALIDADOR COMPLETO
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_career_config_validate_json(_config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  _errors text[] := '{}';
  _item jsonb; _rl jsonb;
  _canonical text[] := ARRAY['BRONZE','PRATA','OURO','PLATINA','DIAMANTE'];
  _labels text[] := ARRAY['Bronze','Prata','Ouro','Platina','Diamante'];
  _idx int := 0; _active int := 0;
  _prev_points numeric := -1;
  _sorts int[] := '{}';
  _rank_pos int; _min_teams int;
BEGIN
  IF _config IS NULL OR jsonb_typeof(_config) <> 'array' THEN
    RETURN jsonb_build_object('valid', false, 'errors', ARRAY['Configuração deve ser um array não nulo']);
  END IF;
  IF jsonb_array_length(_config) <> 5 THEN
    RETURN jsonb_build_object('valid', false, 'errors', ARRAY['Configuração deve conter exatamente cinco graduações']);
  END IF;

  FOR _item IN SELECT value FROM jsonb_array_elements(_config) ORDER BY (value->>'sort_order')::int ASC LOOP
    _idx := _idx + 1;

    IF NOT (_item ? 'rank_key' AND _item ? 'rank_label' AND _item ? 'sort_order'
        AND _item ? 'min_organizational_points' AND _item ? 'max_team_concentration_pct'
        AND _item ? 'min_qualified_teams' AND _item ? 'min_qualified_team_points'
        AND _item ? 'min_active_partners_per_team' AND _item ? 'required_leaders'
        AND _item ? 'is_active') THEN
      _errors := array_append(_errors, format('Graduação na posição %s omitiu campos obrigatórios', _idx));
      CONTINUE;
    END IF;

    IF (SELECT bool_or(jsonb_typeof(_item->k) = 'null') FROM unnest(ARRAY['rank_key','rank_label','sort_order',
        'min_organizational_points','max_team_concentration_pct','min_qualified_teams',
        'min_qualified_team_points','min_active_partners_per_team','required_leaders','is_active']) k) THEN
      _errors := array_append(_errors, format('Graduação na posição %s possui campos nulos', _idx));
      CONTINUE;
    END IF;

    _rank_pos := array_position(_canonical, _item->>'rank_key');
    IF _rank_pos IS NULL THEN
      _errors := array_append(_errors, format('Graduação não canônica: %s', _item->>'rank_key'));
      CONTINUE;
    END IF;
    IF _rank_pos <> _idx THEN
      _errors := array_append(_errors, format('Ordem canônica violada em %s', _item->>'rank_key'));
    END IF;
    IF _item->>'rank_label' <> _labels[_rank_pos] THEN
      _errors := array_append(_errors, format('rank_label inválido para %s', _item->>'rank_key'));
    END IF;

    IF jsonb_typeof(_item->'sort_order') <> 'number'
       OR jsonb_typeof(_item->'min_organizational_points') <> 'number'
       OR jsonb_typeof(_item->'max_team_concentration_pct') <> 'number'
       OR jsonb_typeof(_item->'min_qualified_teams') <> 'number'
       OR jsonb_typeof(_item->'min_qualified_team_points') <> 'number'
       OR jsonb_typeof(_item->'min_active_partners_per_team') <> 'number'
       OR jsonb_typeof(_item->'is_active') <> 'boolean'
       OR jsonb_typeof(_item->'required_leaders') <> 'array' THEN
      _errors := array_append(_errors, format('Tipos inválidos na graduação %s', _item->>'rank_key'));
      CONTINUE;
    END IF;

    IF (_item->>'sort_order')::int <> _rank_pos THEN
      _errors := array_append(_errors, format('sort_order incoerente com a ordem canônica em %s', _item->>'rank_key'));
    END IF;
    IF (_item->>'sort_order')::int = ANY(_sorts) THEN
      _errors := array_append(_errors, format('sort_order duplicado em %s', _item->>'rank_key'));
    END IF;
    _sorts := array_append(_sorts, (_item->>'sort_order')::int);

    IF (_item->>'min_organizational_points')::numeric <= _prev_points THEN
      _errors := array_append(_errors, format('Pontuação não progressiva em %s', _item->>'rank_key'));
    END IF;
    _prev_points := (_item->>'min_organizational_points')::numeric;

    IF (_item->>'max_team_concentration_pct')::numeric < 1 OR (_item->>'max_team_concentration_pct')::numeric > 100 THEN
      _errors := array_append(_errors, format('Concentração deve estar entre 1 e 100 em %s', _item->>'rank_key'));
    END IF;

    _min_teams := (_item->>'min_qualified_teams')::int;
    IF _min_teams < 1 THEN
      _errors := array_append(_errors, format('min_qualified_teams deve ser >= 1 em %s', _item->>'rank_key'));
    END IF;
    IF (_item->>'min_qualified_team_points')::numeric < 0 THEN
      _errors := array_append(_errors, format('min_qualified_team_points inválido em %s', _item->>'rank_key'));
    END IF;
    IF (_item->>'min_active_partners_per_team')::int < 1 THEN
      _errors := array_append(_errors, format('min_active_partners_per_team deve ser >= 1 em %s', _item->>'rank_key'));
    END IF;
    IF NOT (_item->>'is_active')::boolean THEN
      _errors := array_append(_errors, format('Graduação %s deve estar ativa', _item->>'rank_key'));
    ELSE
      _active := _active + 1;
    END IF;

    FOR _rl IN SELECT value FROM jsonb_array_elements(_item->'required_leaders') LOOP
      IF jsonb_typeof(_rl) <> 'object' OR NOT (_rl ? 'rank' AND _rl ? 'count' AND _rl ? 'distinct_teams') THEN
        _errors := array_append(_errors, format('required_leaders malformado em %s', _item->>'rank_key'));
        CONTINUE;
      END IF;
      IF jsonb_typeof(_rl->'count') <> 'number' OR (_rl->>'count')::int < 1 THEN
        _errors := array_append(_errors, format('required_leaders.count inválido em %s', _item->>'rank_key'));
      END IF;
      IF jsonb_typeof(_rl->'distinct_teams') <> 'boolean' THEN
        _errors := array_append(_errors, format('required_leaders.distinct_teams deve ser boolean em %s', _item->>'rank_key'));
      ELSIF (_rl->>'distinct_teams')::boolean AND jsonb_typeof(_rl->'count') = 'number'
            AND (_rl->>'count')::int > _min_teams THEN
        _errors := array_append(_errors, format('required_leaders.count em equipes distintas excede min_qualified_teams em %s', _item->>'rank_key'));
      END IF;
      IF array_position(_canonical, _rl->>'rank') IS NULL THEN
        _errors := array_append(_errors, format('required_leaders.rank não canônico em %s', _item->>'rank_key'));
      ELSIF array_position(_canonical, _rl->>'rank') >= _rank_pos THEN
        _errors := array_append(_errors, format('required_leaders.rank deve ser inferior a %s', _item->>'rank_key'));
      END IF;
    END LOOP;
  END LOOP;

  IF _active <> 5 THEN
    _errors := array_append(_errors, 'Devem existir exatamente cinco graduações ativas');
  END IF;

  RETURN jsonb_build_object('valid', array_length(_errors,1) IS NULL, 'errors', COALESCE(_errors,'{}'));
END; $function$;

-- ---------------------------------------------------------------
-- CONFIGURAÇÃO TEMPORAL
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_career_config_at(_as_of timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _v record;
BEGIN
  SELECT version_number, effective_from, config_hash, config_data INTO _v
    FROM public.expansion_career_config_versions
   WHERE status IN ('PUBLISHED','SUPERSEDED') AND effective_from <= _as_of
   ORDER BY effective_from DESC, version_number DESC LIMIT 1;
  IF _v IS NULL THEN
    RAISE EXCEPTION 'Nenhuma configuração de carreira vigente em %', _as_of;
  END IF;
  RETURN jsonb_build_object('version_number', _v.version_number, 'effective_from', _v.effective_from,
                            'config_hash', _v.config_hash, 'config_data', _v.config_data);
END; $function$;

-- ---------------------------------------------------------------
-- MOTOR COMPLETO DIRIGIDO POR CONFIGURAÇÃO
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_compute_career_state_internal(
  _user_id uuid,
  _evaluated_as_of timestamptz DEFAULT now(),
  _rank_context jsonb DEFAULT '{}'::jsonb,
  _config_override jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_totals record; v_cfg record; v_req jsonb;
  v_max_countable numeric; v_qualified_points numeric; v_qualified_teams integer;
  v_leaders integer; v_distinct_teams integer; v_first_leaders integer; v_first_distinct integer;
  v_leader_details jsonb; v_pending jsonb; v_criteria jsonb; v_met boolean;
  v_ranks jsonb := '[]'::jsonb; v_diagnosed text := 'NONE'; v_diag_label text := 'Nenhum';
  v_best jsonb := NULL; v_next jsonb := NULL; v_ref jsonb;
  v_ctx jsonb := COALESCE(_rank_context, '{}'::jsonb);
  v_meta jsonb; v_config jsonb; v_valid jsonb;
BEGIN
  IF _config_override IS NOT NULL THEN
    v_config := _config_override;
    v_meta := jsonb_build_object('version_number', NULL, 'effective_from', NULL,
                                 'config_hash', encode(digest(_config_override::text,'sha256'),'hex'),
                                 'config_data', _config_override);
  ELSE
    v_meta := public.expansion_career_config_at(_evaluated_as_of);
    v_config := v_meta->'config_data';
  END IF;

  v_valid := public.expansion_career_config_validate_json(v_config);
  IF NOT (v_valid->>'valid')::boolean THEN
    RAISE EXCEPTION 'Configuração de carreira inválida: %', v_valid->'errors';
  END IF;

  SELECT * INTO v_totals FROM public.expansion_career_points_as_of(_user_id, _evaluated_as_of);

  FOR v_cfg IN
    SELECT * FROM jsonb_to_recordset(v_config) AS x(
      rank_key text, rank_label text, sort_order int, min_organizational_points numeric,
      max_team_concentration_pct numeric, min_qualified_teams int, min_qualified_team_points numeric,
      min_active_partners_per_team int, required_leaders jsonb, is_active boolean)
    WHERE is_active ORDER BY sort_order DESC
  LOOP
    v_max_countable := v_cfg.min_organizational_points * (v_cfg.max_team_concentration_pct / 100.0);

    SELECT COALESCE(sum(LEAST(GREATEST(COALESCE(t.net_career_points,0),0), v_max_countable)),0)
      INTO v_qualified_points
      FROM public.expansion_career_points_by_team_as_of(_user_id, _evaluated_as_of) t
     WHERE COALESCE(t.net_career_points,0) > 0;

    SELECT count(*)::int INTO v_qualified_teams
      FROM public.expansion_career_points_by_team_as_of(_user_id, _evaluated_as_of) t
     WHERE COALESCE(t.net_career_points,0) > 0
       AND COALESCE(t.net_career_points,0) >= v_cfg.min_qualified_team_points
       AND COALESCE(t.real_active_partner_count,0) >= v_cfg.min_active_partners_per_team;

    v_pending := '[]'::jsonb;
    IF COALESCE(v_totals.net_career_points,0) < v_cfg.min_organizational_points THEN
      v_pending := v_pending || to_jsonb('PONTOS_BRUTOS_INSUFICIENTES'::text); END IF;
    IF v_qualified_points < v_cfg.min_organizational_points THEN
      v_pending := v_pending || to_jsonb('PONTOS_CONTAVEIS_APOS_CONCENTRACAO_INSUFICIENTES'::text); END IF;
    IF v_qualified_teams < v_cfg.min_qualified_teams THEN
      v_pending := v_pending || to_jsonb('EQUIPES_QUALIFICADAS_INSUFICIENTES'::text); END IF;

    v_leader_details := '[]'::jsonb; v_first_leaders := 0; v_first_distinct := 0;
    FOR v_req IN SELECT value FROM jsonb_array_elements(COALESCE(v_cfg.required_leaders,'[]'::jsonb)) LOOP
      SELECT count(*)::int, count(DISTINCT l.team_root_user_id)::int
        INTO v_leaders, v_distinct_teams
        FROM public.expansion_eligible_leaders_ctx(_user_id, v_req->>'rank', _evaluated_as_of, v_ctx) l;

      IF jsonb_array_length(v_leader_details) = 0 THEN
        v_first_leaders := v_leaders; v_first_distinct := v_distinct_teams;
      END IF;

      IF v_leaders < COALESCE((v_req->>'count')::int,0) THEN
        v_pending := v_pending || to_jsonb('LIDERES_INSUFICIENTES'::text); END IF;
      IF COALESCE((v_req->>'distinct_teams')::boolean,false)
         AND v_distinct_teams < COALESCE((v_req->>'count')::int,0) THEN
        v_pending := v_pending || to_jsonb('LIDERES_EM_EQUIPES_DISTINTAS_INSUFICIENTES'::text); END IF;

      v_leader_details := v_leader_details || jsonb_build_object(
        'required_rank', v_req->>'rank',
        'required_count', COALESCE((v_req->>'count')::int,0),
        'requires_distinct_teams', COALESCE((v_req->>'distinct_teams')::boolean,false),
        'current_count', v_leaders, 'current_distinct_teams', v_distinct_teams,
        'met', v_leaders >= COALESCE((v_req->>'count')::int,0)
               AND (NOT COALESCE((v_req->>'distinct_teams')::boolean,false)
                    OR v_distinct_teams >= COALESCE((v_req->>'count')::int,0)));
    END LOOP;

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
      'leaders', v_leader_details);

    v_met := (jsonb_array_length(v_pending) = 0);

    v_ranks := v_ranks || jsonb_build_object(
      'rank_key', v_cfg.rank_key, 'rank_label', v_cfg.rank_label, 'sort_order', v_cfg.sort_order,
      'required_points', v_cfg.min_organizational_points,
      'max_team_concentration_percent', v_cfg.max_team_concentration_pct,
      'maximum_countable_from_one_team', v_max_countable,
      'qualified_rank_points', v_qualified_points,
      'required_qualified_teams', v_cfg.min_qualified_teams,
      'current_qualified_teams', v_qualified_teams,
      'eligible_leader_count', v_first_leaders, 'distinct_leader_teams', v_first_distinct,
      'leader_requirements', v_leader_details,
      'criteria', v_criteria, 'requirements_met', v_met, 'requirements_pending', v_pending);

    IF v_met AND v_diagnosed = 'NONE' THEN
      v_diagnosed := v_cfg.rank_key; v_diag_label := v_cfg.rank_label;
      v_best := v_ranks -> (jsonb_array_length(v_ranks) - 1);
    END IF;
  END LOOP;

  SELECT r INTO v_next FROM jsonb_array_elements(v_ranks) r
   WHERE NOT (r->>'requirements_met')::boolean
     AND (r->>'sort_order')::int > COALESCE((v_best->>'sort_order')::int, 0)
   ORDER BY (r->>'sort_order')::int ASC LIMIT 1;

  v_ref := COALESCE(v_best, v_next);

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'evaluated_as_of', _evaluated_as_of,
    'rank_key', v_diagnosed,
    'rank_label', v_diag_label,
    'diagnosed_rank', v_diagnosed,
    'next_rank', v_next->>'rank_key',
    'next_rank_label', v_next->>'rank_label',
    'next_rank_required_points', (v_next->>'required_points')::numeric,
    'next_rank_qualified_points', (v_next->>'qualified_rank_points')::numeric,
    'gross_career_points', COALESCE(v_totals.gross_career_points,0),
    'reversed_career_points', COALESCE(v_totals.reversed_career_points,0),
    'net_career_points', COALESCE(v_totals.net_career_points,0),
    'total_teams_with_points', COALESCE(v_totals.teams_with_positive_points,0),
    'largest_team_points', COALESCE(v_totals.largest_team_points,0),
    'largest_team_share_percent', COALESCE(v_totals.largest_team_share_percent,0),
    'qualified_rank_points', COALESCE((v_ref->>'qualified_rank_points')::numeric,0),
    'qualified_teams', COALESCE((v_ref->>'current_qualified_teams')::int,0),
    'eligible_leaders', COALESCE((v_ref->>'eligible_leader_count')::int,0),
    'distinct_leader_teams', COALESCE((v_ref->>'distinct_leader_teams')::int,0),
    'requirements_met', (v_diagnosed <> 'NONE'),
    'requirements_pending', COALESCE(v_ref->'requirements_pending','[]'::jsonb),
    'all_ranks', v_ranks,
    'ranks', v_ranks,
    'config_version', v_meta->'version_number',
    'config_effective_from', v_meta->'effective_from',
    'config_snapshot', v_meta,
    'calculated_at', now());
END; $function$;

CREATE OR REPLACE FUNCTION public.expansion_compute_career_state(
  _user_id uuid, _evaluated_as_of timestamptz DEFAULT now(), _rank_context jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.expansion_compute_career_state_internal(_user_id, _evaluated_as_of, _rank_context, NULL);
$function$;

-- ---------------------------------------------------------------
-- AVALIAÇÃO CANÔNICA (apenas resolução de configuração alterada)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_evaluate_career_internal(
  _user_id uuid, _evaluation_reference text, _source_type text, _source_id uuid,
  _evaluated_as_of timestamptz, _run_id uuid, _calculated_rank_context jsonb DEFAULT '{}'::jsonb,
  _config_snapshot jsonb DEFAULT '{}'::jsonb, _evaluated_by uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_state jsonb; v_new text; v_prev text := 'NONE'; v_high_before text := 'NONE';
  v_high_after text; v_reg record; v_eval_id uuid; v_changed boolean;
  v_cfg_data jsonb; v_cfg_snapshot jsonb;
BEGIN
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

  IF _config_snapshot IS NOT NULL AND jsonb_typeof(_config_snapshot) = 'array' THEN
    v_cfg_data := _config_snapshot;
    v_cfg_snapshot := jsonb_build_object('version_number', NULL, 'effective_from', NULL,
      'config_hash', encode(digest(_config_snapshot::text,'sha256'),'hex'), 'config_data', _config_snapshot);
  ELSIF _config_snapshot IS NOT NULL AND jsonb_typeof(_config_snapshot) = 'object'
        AND jsonb_typeof(_config_snapshot->'config_data') = 'array' THEN
    v_cfg_data := _config_snapshot->'config_data';
    v_cfg_snapshot := _config_snapshot;
  ELSE
    v_cfg_snapshot := public.expansion_career_config_at(_evaluated_as_of);
    v_cfg_data := v_cfg_snapshot->'config_data';
  END IF;

  v_state := public.expansion_compute_career_state_internal(
               _user_id, _evaluated_as_of, _calculated_rank_context, v_cfg_data);
  v_new := v_state->>'rank_key';

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
    now(), _evaluated_by, v_cfg_snapshot, _evaluated_as_of, _run_id)
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
    'highest_rank_ever', v_high_after,
    'config_version', v_cfg_snapshot->'version_number');
END; $function$;

-- ---------------------------------------------------------------
-- PREVIEW BOTTOM-UP REAL (sem escritas)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_preview_config_impact(_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _draft record; _batch jsonb; _u jsonb; _sim jsonb; _new text; _cur text;
  _ctx jsonb := '{}'::jsonb; _prev_ctx jsonb; _stable boolean := false;
  _pass int := 0; _max_passes int := 6;
  _found int := 0; _eligible int := 0; _excluded int := 0; _evaluated int := 0; _failures int := 0;
  _promotions jsonb := '[]'::jsonb; _downgrades jsonb := '[]'::jsonb; _severity text := 'LOW';
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT * INTO _draft FROM public.expansion_career_config_versions WHERE id = _draft_id;
  IF _draft IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;

  -- população: uma linha por user_id
  WITH pop AS (
    SELECT c.user_id,
           bool_or(COALESCE(p.is_bot,false) OR COALESCE(p.is_test_account,false) OR COALESCE(c.is_demo,false)) AS is_excluded
      FROM public.partner_contracts c
      LEFT JOIN public.profiles p ON p.user_id = c.user_id
     WHERE c.status = 'ACTIVE'
     GROUP BY c.user_id
  )
  SELECT count(*)::int,
         count(*) FILTER (WHERE NOT is_excluded)::int,
         count(*) FILTER (WHERE is_excluded)::int
    INTO _found, _eligible, _excluded
    FROM pop;

  -- lote elegível ordenado bottom-up (maior profundidade primeiro)
  WITH pop AS (
    SELECT c.user_id,
           bool_or(COALESCE(p.is_bot,false) OR COALESCE(p.is_test_account,false) OR COALESCE(c.is_demo,false)) AS is_excluded
      FROM public.partner_contracts c
      LEFT JOIN public.profiles p ON p.user_id = c.user_id
     WHERE c.status = 'ACTIVE'
     GROUP BY c.user_id
  ), h AS (
    SELECT pop.user_id,
           COALESCE((SELECT MAX(m.depth) FROM public.expansion_team_memberships m
                      WHERE m.ancestor_user_id = pop.user_id
                        AND m.effective_from <= now()
                        AND (m.effective_to IS NULL OR m.effective_to > now())), 0) AS height
      FROM pop WHERE NOT pop.is_excluded
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', user_id) ORDER BY height ASC, user_id ASC), '[]'::jsonb)
    INTO _batch FROM h;

  WHILE _pass < _max_passes AND NOT _stable LOOP
    _pass := _pass + 1;
    _prev_ctx := _ctx;
    _failures := 0;
    FOR _u IN SELECT value FROM jsonb_array_elements(_batch) LOOP
      BEGIN
        _sim := public.expansion_compute_career_state_internal(
                  (_u->>'user_id')::uuid, now(), _ctx, _draft.config_data);
        _ctx := jsonb_set(_ctx, ARRAY[_u->>'user_id'], to_jsonb(_sim->>'rank_key'), true);
      EXCEPTION WHEN OTHERS THEN
        _failures := _failures + 1;
        _ctx := jsonb_set(_ctx, ARRAY[_u->>'user_id'],
                          to_jsonb(COALESCE(_ctx->>(_u->>'user_id'),'NONE')), true);
      END;
    END LOOP;
    _stable := (_ctx = _prev_ctx);
  END LOOP;

  FOR _u IN SELECT value FROM jsonb_array_elements(_batch) LOOP
    _new := COALESCE(_ctx->>(_u->>'user_id'), 'NONE');
    _cur := COALESCE((SELECT current_rank FROM public.expansion_partner_ranks
                       WHERE user_id = (_u->>'user_id')::uuid), 'NONE');
    _evaluated := _evaluated + 1;
    IF public.expansion_rank_order(_new) > public.expansion_rank_order(_cur) THEN
      _promotions := _promotions || jsonb_build_object('user_id', _u->>'user_id', 'from', _cur, 'to', _new);
    ELSIF public.expansion_rank_order(_new) < public.expansion_rank_order(_cur) THEN
      _downgrades := _downgrades || jsonb_build_object('user_id', _u->>'user_id', 'from', _cur, 'to', _new);
    END IF;
  END LOOP;

  _evaluated := _evaluated - _failures;

  IF jsonb_array_length(_downgrades) > 0 THEN _severity := 'HIGH'; END IF;
  IF _failures > 0 OR NOT _stable THEN _severity := 'CRITICAL'; END IF;

  RETURN jsonb_build_object(
    'reconciles', (_found = _eligible + _excluded AND _eligible = _evaluated + _failures),
    'promotions', _promotions,
    'downgrades', _downgrades,
    'stabilization_iterations', _pass,
    'stabilization_completed', _stable,
    'summary', jsonb_build_object(
      'severity', _severity, 'found', _found, 'eligible', _eligible,
      'excluded', _excluded, 'evaluated', _evaluated, 'failures', _failures,
      'stabilization_iterations', _pass, 'stabilization_completed', _stable,
      'promotions_count', jsonb_array_length(_promotions),
      'downgrades_count', jsonb_array_length(_downgrades)));
END; $function$;

-- ---------------------------------------------------------------
-- RASCUNHO / PUBLICAÇÃO / CANCELAMENTO
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_create_career_config_draft(
  _config_data jsonb, _effective_from timestamptz, _change_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _valid jsonb; _norm jsonb; _id uuid; _num int;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF COALESCE(BTRIM(_change_reason),'') = '' THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;

  SELECT jsonb_agg(value ORDER BY (value->>'sort_order')::int ASC) INTO _norm
    FROM jsonb_array_elements(_config_data);
  _valid := public.expansion_career_config_validate_json(_norm);
  IF NOT (_valid->>'valid')::boolean THEN RAISE EXCEPTION 'Configuração inválida: %', _valid->'errors'; END IF;

  SELECT COALESCE(MAX(version_number),0) + 1 INTO _num FROM public.expansion_career_config_versions;

  INSERT INTO public.expansion_career_config_versions (
    version_number, status, effective_from, config_data, config_hash, created_by, change_reason)
  VALUES (_num, 'DRAFT', _effective_from, _norm, encode(digest(_norm::text,'sha256'),'hex'),
          auth.uid(), _change_reason)
  RETURNING id INTO _id;
  RETURN _id;
END; $function$;

DROP FUNCTION IF EXISTS public.expansion_admin_publish_career_config(uuid, text);
CREATE FUNCTION public.expansion_admin_publish_career_config(_draft_id uuid, _change_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _v record; _res jsonb; _s jsonb; _valid jsonb; _local timestamp; _norm jsonb;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF COALESCE(BTRIM(_change_reason),'') = '' THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('expansion_career_config_publish'));

  SELECT * INTO _v FROM public.expansion_career_config_versions WHERE id = _draft_id FOR UPDATE;
  IF _v IS NULL OR _v.status <> 'DRAFT' THEN RAISE EXCEPTION 'Rascunho inválido ou já processado'; END IF;

  SELECT jsonb_agg(value ORDER BY (value->>'sort_order')::int ASC) INTO _norm
    FROM jsonb_array_elements(_v.config_data);
  _valid := public.expansion_career_config_validate_json(_norm);
  IF NOT (_valid->>'valid')::boolean THEN RAISE EXCEPTION 'Configuração inválida: %', _valid->'errors'; END IF;

  IF _v.effective_from <= now() THEN RAISE EXCEPTION 'Vigência deve ser futura'; END IF;
  _local := _v.effective_from AT TIME ZONE 'America/Bahia';
  IF EXTRACT(DOW FROM _local) <> 1 OR EXTRACT(HOUR FROM _local) <> 0
     OR EXTRACT(MINUTE FROM _local) <> 0 OR EXTRACT(SECOND FROM _local) <> 0 THEN
    RAISE EXCEPTION 'Vigência deve ser segunda-feira 00:00:00.000 (America/Bahia)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.expansion_career_config_versions
              WHERE effective_from = _v.effective_from AND id <> _v.id AND status <> 'CANCELLED') THEN
    RAISE EXCEPTION 'Já existe versão não cancelada nessa vigência';
  END IF;

  _res := public.expansion_admin_preview_config_impact(_draft_id);
  IF _res IS NULL OR jsonb_typeof(_res) <> 'object'
     OR jsonb_typeof(_res->'summary') <> 'object'
     OR jsonb_typeof(_res->'reconciles') <> 'boolean'
     OR jsonb_typeof(_res->'stabilization_completed') <> 'boolean'
     OR jsonb_typeof(_res->'promotions') <> 'array'
     OR jsonb_typeof(_res->'downgrades') <> 'array' THEN
    RAISE EXCEPTION 'Simulação inválida';
  END IF;
  _s := _res->'summary';
  IF jsonb_typeof(_s->'severity') <> 'string'
     OR jsonb_typeof(_s->'found') <> 'number' OR jsonb_typeof(_s->'eligible') <> 'number'
     OR jsonb_typeof(_s->'excluded') <> 'number' OR jsonb_typeof(_s->'evaluated') <> 'number'
     OR jsonb_typeof(_s->'failures') <> 'number' THEN
    RAISE EXCEPTION 'Resumo da simulação inválido';
  END IF;
  IF NOT (_res->>'stabilization_completed')::boolean
     OR (_s->>'found')::int <> (_s->>'eligible')::int + (_s->>'excluded')::int
     OR (_s->>'eligible')::int <> (_s->>'evaluated')::int + (_s->>'failures')::int
     OR (_s->>'failures')::int <> 0
     OR NOT (_res->>'reconciles')::boolean
     OR (_s->>'severity') IN ('HIGH','CRITICAL') THEN
    RAISE EXCEPTION 'Simulação reprovada: %', _res - 'promotions' - 'downgrades';
  END IF;

  UPDATE public.expansion_career_config_versions
     SET status = 'PUBLISHED', config_data = _norm,
         config_hash = encode(digest(_norm::text,'sha256'),'hex'),
         published_at = now(), published_by = auth.uid(),
         change_reason = _change_reason, dry_run_impact_snapshot = _res
   WHERE id = _draft_id;

  RETURN jsonb_build_object('status','PUBLISHED','version_id',_draft_id,
                            'effective_from',_v.effective_from,'impact',_res->'summary');
END; $function$;

DROP FUNCTION IF EXISTS public.expansion_admin_cancel_career_config(uuid, text);
CREATE FUNCTION public.expansion_admin_cancel_career_config(_version_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _v record;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF COALESCE(BTRIM(_reason),'') = '' THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  SELECT * INTO _v FROM public.expansion_career_config_versions WHERE id = _version_id FOR UPDATE;
  IF _v IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF _v.status NOT IN ('DRAFT','PUBLISHED') THEN RAISE EXCEPTION 'Status não cancelável'; END IF;
  IF _v.status = 'PUBLISHED' AND _v.effective_from <= now() THEN
    RAISE EXCEPTION 'Versão vigente não pode ser cancelada';
  END IF;
  PERFORM set_config('expansion.config_lifecycle_bypass','on',true);
  UPDATE public.expansion_career_config_versions
     SET status='CANCELLED', cancelled_at=now(), cancelled_by=auth.uid(), cancellation_reason=_reason
   WHERE id=_version_id;
  PERFORM set_config('expansion.config_lifecycle_bypass','off',true);
  RETURN jsonb_build_object('status','CANCELLED','version_id',_version_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.expansion_admin_career_config_versions()
RETURNS SETOF public.expansion_career_config_versions
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN QUERY SELECT * FROM public.expansion_career_config_versions ORDER BY version_number DESC;
END; $function$;

DROP FUNCTION IF EXISTS public.expansion_admin_get_career_preview(uuid, timestamptz, jsonb);
DROP FUNCTION IF EXISTS public.expansion_admin_get_career_preview(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.expansion_admin_get_career_preview(uuid);
CREATE FUNCTION public.expansion_admin_get_career_preview(_user_id uuid, _as_of timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN public.expansion_compute_career_state_internal(_user_id, _as_of, '{}'::jsonb, NULL);
END; $function$;

DROP FUNCTION IF EXISTS public.expansion_partner_get_my_career(timestamptz);
DROP FUNCTION IF EXISTS public.expansion_partner_get_my_career(uuid);
DROP FUNCTION IF EXISTS public.expansion_partner_get_my_career();
CREATE FUNCTION public.expansion_partner_get_my_career()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  RETURN public.expansion_compute_career_state_internal(auth.uid(), now(), '{}'::jsonb, NULL);
END; $function$;

-- ---------------------------------------------------------------
-- CICLO DE VIDA
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_config_versions_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Exclusão de versões de configuração é proibida';
  END IF;

  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    RAISE EXCEPTION 'Versão cancelada é terminal';
  END IF;
  IF OLD.status = 'SUPERSEDED' AND NEW.status <> 'SUPERSEDED' THEN
    RAISE EXCEPTION 'Versão superada é terminal';
  END IF;

  IF OLD.status = 'PUBLISHED' THEN
    IF NEW.status = 'DRAFT' THEN
      RAISE EXCEPTION 'Versão publicada não retorna a rascunho';
    END IF;
    IF NEW.config_data IS DISTINCT FROM OLD.config_data
       OR NEW.config_hash IS DISTINCT FROM OLD.config_hash
       OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
       OR NEW.version_number IS DISTINCT FROM OLD.version_number THEN
      RAISE EXCEPTION 'Versão publicada é estruturalmente imutável';
    END IF;
    IF NEW.status = 'CANCELLED' THEN
      IF OLD.effective_from <= now() THEN
        RAISE EXCEPTION 'Versão publicada vigente não pode ser cancelada';
      END IF;
      IF COALESCE(current_setting('expansion.config_lifecycle_bypass', true),'off') <> 'on' THEN
        RAISE EXCEPTION 'Cancelamento apenas pelo wrapper oficial';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_expansion_config_versions_lifecycle ON public.expansion_career_config_versions;
CREATE TRIGGER trg_expansion_config_versions_lifecycle
BEFORE UPDATE OR DELETE ON public.expansion_career_config_versions
FOR EACH ROW EXECUTE FUNCTION public.expansion_config_versions_lifecycle();

-- ---------------------------------------------------------------
-- PERMISSÕES
-- ---------------------------------------------------------------
ALTER TABLE public.expansion_career_config_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expansion_career_config_versions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.expansion_career_config_versions TO service_role;

REVOKE ALL ON FUNCTION public.expansion_career_config_at(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_career_config_at(timestamptz) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.expansion_compute_career_state_internal(uuid, timestamptz, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_compute_career_state_internal(uuid, timestamptz, jsonb, jsonb) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.expansion_compute_career_state(uuid, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_compute_career_state(uuid, timestamptz, jsonb) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.expansion_preview_career(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_preview_career(uuid) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.expansion_evaluate_career_internal(uuid, text, text, uuid, timestamptz, uuid, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_evaluate_career_internal(uuid, text, text, uuid, timestamptz, uuid, jsonb, jsonb, uuid) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.expansion_career_config_validate_json(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_career_config_validate_json(jsonb) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.expansion_admin_preview_config_impact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_preview_config_impact(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expansion_admin_create_career_config_draft(jsonb, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_create_career_config_draft(jsonb, timestamptz, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expansion_admin_publish_career_config(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_publish_career_config(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expansion_admin_cancel_career_config(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_cancel_career_config(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expansion_admin_career_config_versions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_career_config_versions() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expansion_admin_get_career_preview(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_get_career_preview(uuid, timestamptz) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expansion_partner_get_my_career() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_partner_get_my_career() TO authenticated, service_role;