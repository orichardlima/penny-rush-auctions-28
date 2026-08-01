
-- ============================================================
-- FONTE CANONICA INTERNA: LIQUIDO POR MOVIMENTO (SOMENTE LEITURA)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_career_ledger_net_rows()
RETURNS TABLE (
  ledger_id uuid,
  user_id uuid,
  contract_id uuid,
  plan_name_canonical text,
  classification text,
  gross_points numeric,
  reversed_points numeric,
  net_points numeric,
  reversal_count integer,
  event_created_at timestamptz,
  source_type text,
  source_id uuid,
  source_ref text,
  is_fully_reversed boolean,
  has_reversal_anomaly boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cfg AS (
    SELECT public.expansion_effective_cutoff() AS cutoff_at,
           COALESCE((SELECT NULLIF(BTRIM(setting_value), '')::jsonb
                       FROM public.system_settings
                      WHERE setting_key = 'expansion_prelaunch_authorized_ledger_ids'), '[]'::jsonb) AS authorized_ids
  ),
  cls AS (
    SELECT l.id,
           l.user_id,
           l.contract_id,
           public.expansion_normalize_plan_name(l.plan_name) AS plan_name_canonical,
           COALESCE(l.points, 0)::numeric AS points,
           l.source,
           l.source_ref,
           l.created_at,
           l.reverses_id,
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
  ),
  rev AS (
    -- reversoes validas: linha REVERSAL confirmada apontando para evento positivo elegivel
    SELECT r.reverses_id AS original_id,
           SUM(ABS(r.points))::numeric AS reversed_points,
           COUNT(*)::integer AS reversal_count
      FROM cls r
      JOIN cls o ON o.id = r.reverses_id
     WHERE r.classification = 'REVERSAL'
       AND o.classification IN ('OFFICIAL', 'PRELAUNCH_AUTHORIZED')
     GROUP BY r.reverses_id
  )
  SELECT e.id,
         e.user_id,
         e.contract_id,
         e.plan_name_canonical,
         e.classification,
         e.points AS gross_points,
         COALESCE(rev.reversed_points, 0) AS reversed_points,
         GREATEST(e.points - COALESCE(rev.reversed_points, 0), 0) AS net_points,
         COALESCE(rev.reversal_count, 0) AS reversal_count,
         e.created_at AS event_created_at,
         e.source AS source_type,
         CASE WHEN e.source_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN e.source_ref::uuid ELSE NULL END AS source_id,
         e.source_ref,
         (COALESCE(rev.reversed_points, 0) >= e.points) AS is_fully_reversed,
         (COALESCE(rev.reversed_points, 0) > e.points) AS has_reversal_anomaly
    FROM cls e
    LEFT JOIN rev ON rev.original_id = e.id
   WHERE e.classification IN ('OFFICIAL', 'PRELAUNCH_AUTHORIZED')
$$;

REVOKE ALL ON FUNCTION public.expansion_career_ledger_net_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expansion_career_ledger_net_rows() TO service_role;

-- Visao publica filtrada (proprio parceiro ou admin)
DROP VIEW IF EXISTS public.expansion_career_ledger_net;
CREATE VIEW public.expansion_career_ledger_net
WITH (security_invoker = true) AS
SELECT n.*
  FROM public.expansion_points_ledger l
  JOIN LATERAL (SELECT * FROM public.expansion_career_ledger_net_rows() x WHERE x.ledger_id = l.id) n ON TRUE
 WHERE l.user_id = auth.uid() OR public.is_admin_user(auth.uid());

REVOKE ALL ON public.expansion_career_ledger_net FROM PUBLIC;
GRANT SELECT ON public.expansion_career_ledger_net TO authenticated, service_role;

-- ============================================================
-- ANOMALIAS DE REVERSAO (ADMINISTRATIVO)
-- ============================================================
DROP VIEW IF EXISTS public.expansion_career_reversal_anomalies;
CREATE VIEW public.expansion_career_reversal_anomalies
WITH (security_invoker = true) AS
WITH cfg AS (
  SELECT public.expansion_effective_cutoff() AS cutoff_at,
         COALESCE((SELECT NULLIF(BTRIM(setting_value), '')::jsonb
                     FROM public.system_settings
                    WHERE setting_key = 'expansion_prelaunch_authorized_ledger_ids'), '[]'::jsonb) AS authorized_ids
),
cls AS (
  SELECT l.id, l.user_id, l.points::numeric AS points, l.reverses_id, l.created_at,
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
)
-- 1) reversoes que ultrapassam o movimento original
SELECT 'REVERSAL_EXCEEDS_ORIGINAL'::text AS anomaly_type,
       'CRITICAL'::text AS severity,
       o.id AS original_ledger_id,
       o.user_id,
       o.points AS original_points,
       agg.reversed_points AS total_reversed_points,
       (agg.reversed_points - o.points) AS excess_points,
       agg.reversal_ledger_ids,
       'Total revertido maior que o movimento original. Liquido mantido em zero; revisar as linhas de reversao.'::text AS recommendation
  FROM cls o
  JOIN LATERAL (
    SELECT SUM(ABS(r.points))::numeric AS reversed_points,
           ARRAY_AGG(r.id) AS reversal_ledger_ids
      FROM cls r
     WHERE r.classification = 'REVERSAL' AND r.reverses_id = o.id
  ) agg ON TRUE
 WHERE o.classification IN ('OFFICIAL', 'PRELAUNCH_AUTHORIZED')
   AND agg.reversed_points > o.points
   AND public.is_admin_user(auth.uid())
UNION ALL
-- 2) reversao sem movimento original
SELECT 'REVERSAL_ORIGINAL_NOT_FOUND', 'CRITICAL', r.reverses_id, r.user_id, NULL::numeric,
       ABS(r.points), NULL::numeric, ARRAY[r.id],
       'Reversao aponta para movimento inexistente. Nenhum desconto aplicado.'
  FROM cls r
 WHERE r.classification = 'REVERSAL'
   AND NOT EXISTS (SELECT 1 FROM cls o WHERE o.id = r.reverses_id)
   AND public.is_admin_user(auth.uid())
UNION ALL
-- 3) reversao apontando para outra reversao
SELECT 'REVERSAL_CHAIN_INVALID', 'HIGH', o.id, r.user_id, o.points,
       ABS(r.points), NULL::numeric, ARRAY[r.id],
       'Reversao aponta para outra reversao. Nenhum desconto aplicado.'
  FROM cls r
  JOIN cls o ON o.id = r.reverses_id
 WHERE r.classification = 'REVERSAL' AND o.classification = 'REVERSAL'
   AND public.is_admin_user(auth.uid())
UNION ALL
-- 4) reversao apontando para movimento nao elegivel
SELECT 'REVERSAL_ORIGINAL_INELIGIBLE', 'HIGH', o.id, r.user_id, o.points,
       ABS(r.points), NULL::numeric, ARRAY[r.id],
       'Reversao aponta para movimento nao elegivel (invalido ou pre-lancamento nao autorizado). Nenhum desconto aplicado.'
  FROM cls r
  JOIN cls o ON o.id = r.reverses_id
 WHERE r.classification = 'REVERSAL'
   AND o.classification IN ('INVALID', 'PRELAUNCH_UNAUTHORIZED')
   AND public.is_admin_user(auth.uid());

REVOKE ALL ON public.expansion_career_reversal_anomalies FROM PUBLIC;
GRANT SELECT ON public.expansion_career_reversal_anomalies TO authenticated, service_role;

-- ============================================================
-- PONTOS DE CARREIRA POR EQUIPE RAIZ
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_career_points_by_team(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  ancestor_user_id uuid,
  team_root_user_id uuid,
  team_public_name text,
  gross_career_points numeric,
  reversed_career_points numeric,
  net_career_points numeric,
  real_active_partner_count integer,
  is_qualified_team boolean,
  share_of_total_percent numeric,
  first_valid_event_at timestamptz,
  last_valid_event_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid := COALESCE(_user_id, auth.uid());
  _min_active integer := COALESCE((SELECT NULLIF(BTRIM(setting_value), '')::integer
                                     FROM public.system_settings
                                    WHERE setting_key = 'expansion_min_active_partners_per_team'), 1);
  _min_points numeric := COALESCE((SELECT NULLIF(BTRIM(setting_value), '')::numeric
                                     FROM public.system_settings
                                    WHERE setting_key = 'expansion_min_qualified_team_points'), 0);
BEGIN
  IF _target IS NULL THEN
    RAISE EXCEPTION 'usuario nao informado';
  END IF;
  IF _target <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'acesso negado';
  END IF;

  RETURN QUERY
  WITH net AS (
    SELECT * FROM public.expansion_career_ledger_net_rows()
  ),
  ev AS (
    SELECT m.team_root_user_id AS root_id,
           SUM(n.gross_points)::numeric    AS gross_points,
           SUM(n.reversed_points)::numeric AS reversed_points,
           SUM(n.net_points)::numeric      AS net_points,
           MIN(n.event_created_at)         AS first_at,
           MAX(n.event_created_at)         AS last_at
      FROM net n
      JOIN public.expansion_team_memberships m
        ON m.ancestor_user_id = _target
       AND m.descendant_user_id = n.user_id
       AND n.event_created_at >= m.effective_from
       AND (m.effective_to IS NULL OR n.event_created_at < m.effective_to)
     GROUP BY m.team_root_user_id
  ),
  act AS (
    SELECT m.team_root_user_id AS root_id,
           COUNT(DISTINCT c.user_id)::integer AS partners
      FROM public.expansion_team_memberships m
      JOIN public.partner_contracts c
        ON c.user_id = m.descendant_user_id
       AND c.status = 'ACTIVE'
       AND c.is_demo IS NOT TRUE
      LEFT JOIN public.profiles p ON p.user_id = c.user_id
     WHERE m.ancestor_user_id = _target
       AND m.effective_to IS NULL
       AND COALESCE(p.is_bot, false) = false
       AND COALESCE(p.is_test_account, false) = false
     GROUP BY m.team_root_user_id
  ),
  base AS (
    SELECT COALESCE(ev.root_id, act.root_id) AS root_id,
           COALESCE(ev.gross_points, 0)    AS gross_points,
           COALESCE(ev.reversed_points, 0) AS reversed_points,
           COALESCE(ev.net_points, 0)      AS net_points,
           COALESCE(act.partners, 0)       AS partners,
           ev.first_at, ev.last_at
      FROM ev
      FULL JOIN act ON act.root_id = ev.root_id
  ),
  tot AS (SELECT NULLIF(SUM(b.net_points), 0) AS total FROM base b),
  named AS (
    SELECT b.*,
           ROW_NUMBER() OVER (ORDER BY b.net_points DESC, b.root_id) AS rn,
           p.full_name
      FROM base b
      LEFT JOIN public.profiles p ON p.user_id = b.root_id
  )
  SELECT _target AS ancestor_user_id,
         nm.root_id,
         CASE
           WHEN NULLIF(BTRIM(COALESCE(nm.full_name, '')), '') IS NULL THEN 'Equipe ' || nm.rn::text
           WHEN POSITION(' ' IN BTRIM(nm.full_name)) > 0
             THEN SPLIT_PART(BTRIM(nm.full_name), ' ', 1) || ' ' ||
                  UPPER(LEFT(SPLIT_PART(BTRIM(nm.full_name), ' ', 2), 1)) || '.'
           ELSE BTRIM(nm.full_name)
         END AS team_public_name,
         nm.gross_points,
         nm.reversed_points,
         nm.net_points,
         nm.partners,
         (nm.net_points > 0 AND nm.net_points >= _min_points AND nm.partners >= _min_active) AS is_qualified_team,
         ROUND(COALESCE(nm.net_points / (SELECT total FROM tot), 0) * 100, 2) AS share_of_total_percent,
         nm.first_at,
         nm.last_at
    FROM named nm
   ORDER BY nm.net_points DESC, nm.root_id;
END;
$$;

-- ============================================================
-- PONTOS DE CARREIRA (TOTAL DO PARCEIRO)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_career_points(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  user_id uuid,
  gross_career_points numeric,
  reversed_career_points numeric,
  net_career_points numeric,
  teams_with_positive_points integer,
  qualified_teams integer,
  largest_team_points numeric,
  other_teams_points numeric,
  largest_team_share_percent numeric,
  official_event_count integer,
  authorized_prelaunch_event_count integer,
  reversal_count integer,
  calculated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid := COALESCE(_user_id, auth.uid());
BEGIN
  IF _target IS NULL THEN
    RAISE EXCEPTION 'usuario nao informado';
  END IF;
  IF _target <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'acesso negado';
  END IF;

  RETURN QUERY
  WITH t AS (SELECT * FROM public.expansion_career_points_by_team(_target)),
  agg AS (
    SELECT COALESCE(SUM(t.gross_career_points), 0)::numeric    AS gross_pts,
           COALESCE(SUM(t.reversed_career_points), 0)::numeric AS rev_pts,
           COALESCE(SUM(t.net_career_points), 0)::numeric      AS net_pts,
           COUNT(*) FILTER (WHERE t.net_career_points > 0)::integer AS teams_pos,
           COUNT(*) FILTER (WHERE t.is_qualified_team)::integer      AS teams_qual,
           COALESCE(MAX(t.net_career_points), 0)::numeric            AS largest
      FROM t
  ),
  ev AS (
    SELECT COUNT(*) FILTER (WHERE n.classification = 'OFFICIAL')::integer AS official_cnt,
           COUNT(*) FILTER (WHERE n.classification = 'PRELAUNCH_AUTHORIZED')::integer AS prelaunch_cnt,
           COALESCE(SUM(n.reversal_count), 0)::integer AS rev_cnt
      FROM public.expansion_career_ledger_net_rows() n
     WHERE EXISTS (
       SELECT 1 FROM public.expansion_team_memberships m
        WHERE m.ancestor_user_id = _target
          AND m.descendant_user_id = n.user_id
          AND n.event_created_at >= m.effective_from
          AND (m.effective_to IS NULL OR n.event_created_at < m.effective_to)
     )
  )
  SELECT _target,
         agg.gross_pts,
         agg.rev_pts,
         agg.net_pts,
         agg.teams_pos,
         agg.teams_qual,
         agg.largest,
         GREATEST(agg.net_pts - agg.largest, 0),
         CASE WHEN agg.net_pts > 0 THEN ROUND(agg.largest / agg.net_pts * 100, 2) ELSE 0 END,
         ev.official_cnt,
         ev.prelaunch_cnt,
         ev.rev_cnt,
         now()
    FROM agg CROSS JOIN ev;
END;
$$;

REVOKE ALL ON FUNCTION public.expansion_career_points_by_team(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_career_points(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expansion_career_points_by_team(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expansion_career_points(uuid) TO authenticated, service_role;
