
-- ETAPA A - PARTE 3/3: FUNDACAO DAS GRADUACOES (DIAGNOSTICO SOMENTE LEITURA)

CREATE OR REPLACE FUNCTION public.expansion_rank_order(_rank text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE upper(coalesce(_rank,'NONE'))
    WHEN 'NONE' THEN 0 WHEN 'BRONZE' THEN 1 WHEN 'PRATA' THEN 2
    WHEN 'OURO' THEN 3 WHEN 'PLATINA' THEN 4 WHEN 'DIAMANTE' THEN 5
    ELSE -1 END
$$;
REVOKE ALL ON FUNCTION public.expansion_rank_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expansion_rank_order(text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.expansion_partner_ranks (
  user_id uuid PRIMARY KEY,
  current_rank text NOT NULL DEFAULT 'NONE',
  current_rank_since timestamptz,
  highest_rank_ever text NOT NULL DEFAULT 'NONE',
  highest_rank_at timestamptz,
  last_evaluated_at timestamptz,
  last_evaluation_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expansion_partner_ranks_current_rank_chk
    CHECK (current_rank IN ('NONE','BRONZE','PRATA','OURO','PLATINA','DIAMANTE')),
  CONSTRAINT expansion_partner_ranks_highest_rank_chk
    CHECK (highest_rank_ever IN ('NONE','BRONZE','PRATA','OURO','PLATINA','DIAMANTE'))
);
GRANT SELECT ON public.expansion_partner_ranks TO authenticated;
GRANT ALL ON public.expansion_partner_ranks TO service_role;
ALTER TABLE public.expansion_partner_ranks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_ranks_select_self_or_admin" ON public.expansion_partner_ranks;
CREATE POLICY "partner_ranks_select_self_or_admin"
ON public.expansion_partner_ranks FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.expansion_partner_ranks_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND public.expansion_rank_order(NEW.highest_rank_ever)
       < public.expansion_rank_order(OLD.highest_rank_ever) THEN
    RAISE EXCEPTION 'highest_rank_ever nao pode diminuir (% -> %)', OLD.highest_rank_ever, NEW.highest_rank_ever;
  END IF;
  IF public.expansion_rank_order(NEW.highest_rank_ever) < public.expansion_rank_order(NEW.current_rank) THEN
    NEW.highest_rank_ever := NEW.current_rank;
    NEW.highest_rank_at := coalesce(NEW.highest_rank_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_expansion_partner_ranks_guard ON public.expansion_partner_ranks;
CREATE TRIGGER trg_expansion_partner_ranks_guard
BEFORE INSERT OR UPDATE ON public.expansion_partner_ranks
FOR EACH ROW EXECUTE FUNCTION public.expansion_partner_ranks_guard();

CREATE TABLE IF NOT EXISTS public.expansion_rank_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  previous_rank text NOT NULL DEFAULT 'NONE',
  evaluated_rank text NOT NULL DEFAULT 'NONE',
  highest_rank_before text NOT NULL DEFAULT 'NONE',
  highest_rank_after text NOT NULL DEFAULT 'NONE',
  evaluation_reference text NOT NULL,
  source_type text NOT NULL DEFAULT 'MANUAL',
  source_id uuid,
  gross_career_points numeric NOT NULL DEFAULT 0,
  reversed_career_points numeric NOT NULL DEFAULT 0,
  net_career_points numeric NOT NULL DEFAULT 0,
  qualified_rank_points numeric NOT NULL DEFAULT 0,
  qualified_teams integer NOT NULL DEFAULT 0,
  largest_team_share_percent numeric NOT NULL DEFAULT 0,
  eligible_leaders integer NOT NULL DEFAULT 0,
  requirements_met boolean NOT NULL DEFAULT false,
  requirements_pending jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  evaluated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expansion_rank_evaluations_unique UNIQUE (user_id, evaluation_reference),
  CONSTRAINT expansion_rank_evaluations_ranks_chk CHECK (
    previous_rank IN ('NONE','BRONZE','PRATA','OURO','PLATINA','DIAMANTE') AND
    evaluated_rank IN ('NONE','BRONZE','PRATA','OURO','PLATINA','DIAMANTE') AND
    highest_rank_before IN ('NONE','BRONZE','PRATA','OURO','PLATINA','DIAMANTE') AND
    highest_rank_after IN ('NONE','BRONZE','PRATA','OURO','PLATINA','DIAMANTE'))
);
CREATE INDEX IF NOT EXISTS expansion_rank_evaluations_user_idx
  ON public.expansion_rank_evaluations(user_id, evaluated_at DESC);
GRANT SELECT ON public.expansion_rank_evaluations TO authenticated;
GRANT ALL ON public.expansion_rank_evaluations TO service_role;
ALTER TABLE public.expansion_rank_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rank_evaluations_select_self_or_admin" ON public.expansion_rank_evaluations;
CREATE POLICY "rank_evaluations_select_self_or_admin"
ON public.expansion_rank_evaluations FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.expansion_validate_required_leaders(_payload jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE el jsonb; k text; v_rank text; v_count numeric;
BEGIN
  IF _payload IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(_payload) <> 'array' THEN
    RAISE EXCEPTION 'required_leaders deve ser um array JSONB'; END IF;
  FOR el IN SELECT * FROM jsonb_array_elements(_payload) LOOP
    IF jsonb_typeof(el) <> 'object' THEN
      RAISE EXCEPTION 'required_leaders: cada item deve ser objeto'; END IF;
    FOR k IN SELECT jsonb_object_keys(el) LOOP
      IF k NOT IN ('rank','count','distinct_teams') THEN
        RAISE EXCEPTION 'required_leaders: chave nao permitida "%"', k; END IF;
    END LOOP;
    IF NOT (el ? 'rank') OR NOT (el ? 'count') THEN
      RAISE EXCEPTION 'required_leaders: chaves obrigatorias rank e count'; END IF;
    IF jsonb_typeof(el->'rank') = 'null' THEN v_rank := NULL;
    ELSIF jsonb_typeof(el->'rank') = 'string' THEN
      v_rank := el->>'rank';
      IF public.expansion_rank_order(v_rank) <= 0 THEN
        RAISE EXCEPTION 'required_leaders: rank invalido "%"', v_rank; END IF;
    ELSE RAISE EXCEPTION 'required_leaders: rank deve ser texto canonico ou null'; END IF;
    IF jsonb_typeof(el->'count') <> 'number' THEN
      RAISE EXCEPTION 'required_leaders: count deve ser numero'; END IF;
    v_count := (el->>'count')::numeric;
    IF v_count < 0 OR v_count <> trunc(v_count) THEN
      RAISE EXCEPTION 'required_leaders: count deve ser inteiro nao negativo'; END IF;
    IF v_rank IS NULL AND v_count <> 0 THEN
      RAISE EXCEPTION 'required_leaders: count deve ser 0 quando rank for null'; END IF;
    IF v_rank IS NOT NULL AND v_count = 0 THEN
      RAISE EXCEPTION 'required_leaders: count > 0 exigido quando rank informado'; END IF;
    IF el ? 'distinct_teams' AND jsonb_typeof(el->'distinct_teams') <> 'boolean' THEN
      RAISE EXCEPTION 'required_leaders: distinct_teams deve ser boolean'; END IF;
    IF coalesce((el->>'distinct_teams')::boolean, false) AND v_count < 2 THEN
      RAISE EXCEPTION 'required_leaders: distinct_teams exige count >= 2'; END IF;
  END LOOP;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.expansion_validate_required_leaders(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expansion_validate_required_leaders(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expansion_career_config_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.expansion_validate_required_leaders(NEW.required_leaders);
  IF public.expansion_rank_order(NEW.rank_key) <= 0 THEN
    RAISE EXCEPTION 'rank_key invalido: %', NEW.rank_key; END IF;
  IF NEW.max_team_concentration_pct <= 0 OR NEW.max_team_concentration_pct > 100 THEN
    RAISE EXCEPTION 'max_team_concentration_pct deve estar entre 0 e 100'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_expansion_career_config_validate ON public.expansion_career_config;
CREATE TRIGGER trg_expansion_career_config_validate
BEFORE INSERT OR UPDATE ON public.expansion_career_config
FOR EACH ROW EXECUTE FUNCTION public.expansion_career_config_validate();

UPDATE public.expansion_career_config SET min_organizational_points=1000, min_qualified_teams=2,
  max_team_concentration_pct=70, min_qualified_team_points=0, min_active_partners_per_team=1,
  required_leaders='[]'::jsonb WHERE rank_key='BRONZE';
UPDATE public.expansion_career_config SET min_organizational_points=4000, min_qualified_teams=2,
  max_team_concentration_pct=60, min_qualified_team_points=0, min_active_partners_per_team=1,
  required_leaders='[{"rank":"BRONZE","count":1,"distinct_teams":false}]'::jsonb WHERE rank_key='PRATA';
UPDATE public.expansion_career_config SET min_organizational_points=10000, min_qualified_teams=3,
  max_team_concentration_pct=50, min_qualified_team_points=0, min_active_partners_per_team=1,
  required_leaders='[{"rank":"PRATA","count":2,"distinct_teams":true}]'::jsonb WHERE rank_key='OURO';
UPDATE public.expansion_career_config SET min_organizational_points=30000, min_qualified_teams=3,
  max_team_concentration_pct=50, min_qualified_team_points=0, min_active_partners_per_team=1,
  required_leaders='[{"rank":"OURO","count":2,"distinct_teams":true}]'::jsonb WHERE rank_key='PLATINA';
UPDATE public.expansion_career_config SET min_organizational_points=100000, min_qualified_teams=4,
  max_team_concentration_pct=40, min_qualified_team_points=0, min_active_partners_per_team=1,
  required_leaders='[{"rank":"PLATINA","count":3,"distinct_teams":true}]'::jsonb WHERE rank_key='DIAMANTE';

CREATE OR REPLACE FUNCTION public.expansion_eligible_leaders(_user_id uuid, _min_rank text)
RETURNS TABLE(leader_user_id uuid, team_root_user_id uuid, leader_rank text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (m.descendant_user_id)
         m.descendant_user_id, m.team_root_user_id, r.current_rank
  FROM public.expansion_team_memberships m
  JOIN public.expansion_partner_ranks r ON r.user_id = m.descendant_user_id
  WHERE m.ancestor_user_id = _user_id
    AND m.descendant_user_id <> _user_id
    AND m.effective_to IS NULL
    AND _min_rank IS NOT NULL
    AND r.current_rank <> 'NONE'
    AND public.expansion_rank_order(r.current_rank) >= public.expansion_rank_order(_min_rank)
  ORDER BY m.descendant_user_id, public.expansion_rank_order(r.current_rank) DESC
$$;
REVOKE ALL ON FUNCTION public.expansion_eligible_leaders(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expansion_eligible_leaders(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expansion_preview_career(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_totals record; v_cfg record; v_req jsonb; v_req_rank text;
  v_req_count integer; v_distinct boolean; v_max_countable numeric;
  v_qualified_points numeric; v_qualified_teams integer;
  v_leaders integer; v_distinct_teams integer;
  v_pending jsonb; v_criteria jsonb; v_met boolean;
  v_ranks jsonb := '[]'::jsonb; v_diagnosed text := 'NONE';
  v_next text; v_cur text := 'NONE'; v_high text := 'NONE'; v_reg record;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.is_admin_user(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_totals FROM public.expansion_career_points(_user_id);
  SELECT count(*) FILTER (WHERE is_qualified_team) INTO v_qualified_teams
    FROM public.expansion_career_points_by_team(_user_id);
  SELECT current_rank, highest_rank_ever INTO v_reg
    FROM public.expansion_partner_ranks WHERE user_id = _user_id;
  IF FOUND THEN v_cur := v_reg.current_rank; v_high := v_reg.highest_rank_ever; END IF;

  FOR v_cfg IN SELECT * FROM public.expansion_career_config WHERE is_active ORDER BY sort_order DESC LOOP
    v_max_countable := v_cfg.min_organizational_points * (v_cfg.max_team_concentration_pct / 100.0);

    SELECT coalesce(sum(LEAST(t.net_career_points, v_max_countable)), 0) INTO v_qualified_points
      FROM public.expansion_career_points_by_team(_user_id) t
      WHERE t.net_career_points > 0;

    v_req := CASE WHEN jsonb_array_length(coalesce(v_cfg.required_leaders,'[]'::jsonb)) > 0
                  THEN v_cfg.required_leaders->0 ELSE NULL END;
    v_req_rank := CASE WHEN v_req IS NULL OR jsonb_typeof(v_req->'rank')='null' THEN NULL ELSE v_req->>'rank' END;
    v_req_count := coalesce((v_req->>'count')::integer, 0);
    v_distinct := coalesce((v_req->>'distinct_teams')::boolean, false);

    v_leaders := 0; v_distinct_teams := 0;
    IF v_req_rank IS NOT NULL THEN
      SELECT count(*)::int, count(DISTINCT l.team_root_user_id)::int INTO v_leaders, v_distinct_teams
        FROM public.expansion_eligible_leaders(_user_id, v_req_rank) l;
    END IF;

    v_pending := '[]'::jsonb;
    IF coalesce(v_totals.net_career_points,0) < v_cfg.min_organizational_points THEN
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
        'current', coalesce(v_totals.net_career_points,0),
        'met', coalesce(v_totals.net_career_points,0) >= v_cfg.min_organizational_points),
      'points_countable', jsonb_build_object('required', v_cfg.min_organizational_points,
        'current', v_qualified_points, 'met', v_qualified_points >= v_cfg.min_organizational_points),
      'concentration', jsonb_build_object('max_team_concentration_percent', v_cfg.max_team_concentration_pct,
        'maximum_countable_from_one_team', v_max_countable,
        'largest_team_share_percent', coalesce(v_totals.largest_team_share_percent,0)),
      'qualified_teams', jsonb_build_object('required', v_cfg.min_qualified_teams,
        'current', v_qualified_teams, 'met', v_qualified_teams >= v_cfg.min_qualified_teams),
      'leaders', CASE WHEN v_req_rank IS NULL THEN jsonb_build_object('applicable', false)
        ELSE jsonb_build_object('applicable', true, 'required_rank', v_req_rank,
          'required_count', v_req_count, 'current_count', v_leaders,
          'met', v_leaders >= v_req_count) END,
      'leader_distinct_teams', CASE WHEN v_req_rank IS NULL OR NOT v_distinct
        THEN jsonb_build_object('applicable', false)
        ELSE jsonb_build_object('applicable', true, 'required', v_req_count,
          'current', v_distinct_teams, 'met', v_distinct_teams >= v_req_count) END
    );

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
      'criteria', v_criteria,
      'requirements_met', v_met, 'requirements_pending', v_pending);

    IF v_met AND v_diagnosed = 'NONE' THEN v_diagnosed := v_cfg.rank_key; END IF;
  END LOOP;

  SELECT rank_key INTO v_next FROM public.expansion_career_config
   WHERE is_active AND sort_order > coalesce(
     (SELECT sort_order FROM public.expansion_career_config WHERE rank_key = v_cur), 0)
   ORDER BY sort_order ASC LIMIT 1;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'registered_current_rank', v_cur,
    'highest_rank_ever', v_high,
    'diagnosed_rank', v_diagnosed,
    'next_rank', v_next,
    'gross_career_points', coalesce(v_totals.gross_career_points,0),
    'reversed_career_points', coalesce(v_totals.reversed_career_points,0),
    'net_career_points', coalesce(v_totals.net_career_points,0),
    'total_teams_with_points', coalesce(v_totals.teams_with_positive_points,0),
    'qualified_teams', v_qualified_teams,
    'largest_team_points', coalesce(v_totals.largest_team_points,0),
    'largest_team_share_percent', coalesce(v_totals.largest_team_share_percent,0),
    'ranks', v_ranks,
    'calculated_at', now());
END; $$;
REVOKE ALL ON FUNCTION public.expansion_preview_career(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expansion_preview_career(uuid) TO authenticated, service_role;
