-- 1) Colunas temporais
ALTER TABLE public.expansion_team_memberships
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS effective_to   TIMESTAMPTZ NULL;

-- backfill: vínculos existentes valem desde sua criação
UPDATE public.expansion_team_memberships
   SET effective_from = created_at
 WHERE effective_from > created_at;

-- 2) Unicidade apenas para vínculos abertos
ALTER TABLE public.expansion_team_memberships
  DROP CONSTRAINT IF EXISTS expansion_team_memberships_ancestor_user_id_descendant_user_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_etm_open
  ON public.expansion_team_memberships (ancestor_user_id, descendant_user_id)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_etm_temporal
  ON public.expansion_team_memberships (ancestor_user_id, descendant_user_id, effective_from, effective_to);

-- 3) Recompute versionado (fecha em vez de apagar)
CREATE OR REPLACE FUNCTION public.expansion_recompute_memberships(_contract_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID; v_referrer UUID; v_ancestor UUID; v_prev UUID;
  v_depth INT := 0; v_inserted INT := 0; v_now TIMESTAMPTZ := now();
  v_chain JSONB := '[]'::jsonb;
BEGIN
  SELECT user_id, referred_by_user_id INTO v_user, v_referrer
  FROM public.partner_contracts WHERE id = _contract_id;
  IF v_user IS NULL THEN RETURN 0; END IF;

  IF v_referrer IS NOT NULL THEN
    v_prev := v_user;
    v_ancestor := v_referrer;
    WHILE v_ancestor IS NOT NULL LOOP
      v_depth := v_depth + 1;
      v_chain := v_chain || jsonb_build_object('ancestor', v_ancestor, 'team_root', v_prev, 'depth', v_depth);
      EXIT WHEN v_depth > 50;
      v_prev := v_ancestor;
      SELECT referred_by_user_id INTO v_ancestor
        FROM public.partner_contracts
       WHERE user_id = v_ancestor AND status='ACTIVE'
       ORDER BY created_at ASC LIMIT 1;
    END LOOP;
  END IF;

  -- encerra vínculos abertos que não pertencem mais à cadeia atual
  UPDATE public.expansion_team_memberships m
     SET effective_to = v_now
   WHERE m.descendant_user_id = v_user
     AND m.effective_to IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_chain) c
        WHERE (c->>'ancestor')::uuid = m.ancestor_user_id
          AND (c->>'team_root')::uuid = m.team_root_user_id
          AND (c->>'depth')::int = m.depth
     );

  -- abre os vínculos da cadeia atual que ainda não existem
  INSERT INTO public.expansion_team_memberships
    (ancestor_user_id, descendant_user_id, team_root_user_id, depth, descendant_contract_id, effective_from)
  SELECT (c->>'ancestor')::uuid, v_user, (c->>'team_root')::uuid, (c->>'depth')::int, _contract_id, v_now
    FROM jsonb_array_elements(v_chain) c
   WHERE NOT EXISTS (
     SELECT 1 FROM public.expansion_team_memberships m
      WHERE m.descendant_user_id = v_user
        AND m.ancestor_user_id = (c->>'ancestor')::uuid
        AND m.effective_to IS NULL
   );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN v_inserted;
END;
$function$;

-- 4) Saldos por equipe com atribuição temporal do ponto
CREATE OR REPLACE FUNCTION public.expansion_team_balances(_user_id uuid, _period_end date)
RETURNS TABLE(team_root_user_id uuid, points_earned numeric, points_consumed numeric, points_available numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH earned AS (
    SELECT m.team_root_user_id AS team, SUM(l.points)::numeric AS pts
      FROM public.expansion_team_memberships m
      JOIN public.expansion_points_ledger l ON l.user_id = m.descendant_user_id
     WHERE m.ancestor_user_id = _user_id
       AND l.status = 'CONFIRMED'
       AND (l.created_at AT TIME ZONE 'America/Bahia')::date <= _period_end
       AND l.created_at >= m.effective_from
       AND (m.effective_to IS NULL OR l.created_at < m.effective_to)
     GROUP BY 1
  ), consumed AS (
    SELECT c.team_root_user_id AS team, SUM(c.points_consumed)::numeric AS pts
      FROM public.expansion_team_consumptions c
     WHERE c.user_id = _user_id AND c.period_end <= _period_end
     GROUP BY 1
  )
  SELECT COALESCE(e.team, c.team),
         COALESCE(e.pts,0),
         COALESCE(c.pts,0),
         COALESCE(e.pts,0) - COALESCE(c.pts,0)
    FROM earned e FULL OUTER JOIN consumed c ON c.team = e.team;
$function$;

-- 5) Imutabilidade: nunca apagar vínculo com pontos; alterações estruturais viram encerramento
CREATE OR REPLACE FUNCTION public.expansion_block_membership_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.expansion_points_ledger l
              WHERE l.user_id = OLD.descendant_user_id AND l.status='CONFIRMED') THEN
    RAISE EXCEPTION 'Vínculo de equipe com pontos confirmados não pode ser excluído. Encerre-o definindo effective_to.';
  END IF;
  RETURN OLD;
END; $function$;

CREATE OR REPLACE FUNCTION public.expansion_block_membership_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.ancestor_user_id IS DISTINCT FROM OLD.ancestor_user_id
      OR NEW.team_root_user_id IS DISTINCT FROM OLD.team_root_user_id
      OR NEW.depth IS DISTINCT FROM OLD.depth
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from)
     AND EXISTS (SELECT 1 FROM public.expansion_points_ledger l
                  WHERE l.user_id = OLD.descendant_user_id AND l.status='CONFIRMED') THEN
    RAISE EXCEPTION 'Vínculo de equipe com pontos confirmados é imutável. Encerre o vínculo (effective_to) e crie um novo.';
  END IF;
  IF OLD.effective_to IS NOT NULL AND NEW.effective_to IS DISTINCT FROM OLD.effective_to THEN
    RAISE EXCEPTION 'Vínculo já encerrado não pode ser reaberto ou reencerrado.';
  END IF;
  RETURN NEW;
END; $function$;

-- 6) Contagens administrativas consideram apenas vínculos vigentes
CREATE OR REPLACE FUNCTION public.expansion_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_ps DATE; v_pe DATE;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT period_start, period_end INTO v_ps, v_pe FROM public.expansion_current_period();

  RETURN jsonb_build_object(
    'settings', (SELECT jsonb_object_agg(setting_key, setting_value) FROM public.system_settings WHERE setting_key LIKE 'expansion%'),
    'current_period_start', v_ps, 'current_period_end', v_pe, 'next_close_date', v_pe + 1,
    'last_closed_week', public.expansion_last_closed_week(),
    'partners_with_teams', (SELECT COUNT(DISTINCT ancestor_user_id) FROM public.expansion_team_memberships WHERE effective_to IS NULL),
    'teams_total', (SELECT COUNT(*) FROM (SELECT DISTINCT ancestor_user_id, team_root_user_id FROM public.expansion_team_memberships WHERE effective_to IS NULL) z),
    'points_available_total', (SELECT COALESCE(SUM(points),0) FROM public.expansion_points_ledger WHERE status='CONFIRMED')
       - (SELECT COALESCE(SUM(points_consumed),0) FROM public.expansion_team_consumptions),
    'vqe_total', (SELECT COALESCE(SUM(vqe_points),0) FROM public.expansion_period_snapshots),
    'bonus_pending_release', (SELECT COALESCE(SUM(final_bonus),0) FROM public.expansion_period_snapshots WHERE status_official='closed'),
    'bonus_released', (SELECT COALESCE(SUM(final_bonus),0) FROM public.expansion_period_snapshots WHERE status_official='released'),
    'snapshots_closed_count', (SELECT COUNT(*) FROM public.expansion_period_snapshots WHERE status_official='closed'),
    'recent_errors', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'period_start',period_start,'status',status,'error_message',error_message,'started_at',started_at) ORDER BY started_at DESC)
        FROM (SELECT * FROM public.expansion_close_runs WHERE COALESCE(error_count,0)>0 OR status='ERROR' ORDER BY started_at DESC LIMIT 5) e), '[]'::jsonb)
  );
END; $function$;

-- 7) Painel do parceiro: membros vigentes e pontos da semana com atribuição temporal
CREATE OR REPLACE FUNCTION public.expansion_get_partner_teams(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ps DATE; v_pe DATE; v_total NUMERIC := 0; v_largest UUID; v_res JSONB;
BEGIN
  IF _user_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF _user_id <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN RETURN '[]'::jsonb; END IF;
  SELECT period_start, period_end INTO v_ps, v_pe FROM public.expansion_current_period();

  SELECT COALESCE(SUM(points_available),0) INTO v_total
    FROM public.expansion_team_balances(_user_id, v_pe) WHERE points_available>0;

  SELECT team_root_user_id INTO v_largest
    FROM public.expansion_team_balances(_user_id, v_pe)
   WHERE points_available>0 ORDER BY points_available DESC, team_root_user_id ASC LIMIT 1;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'points_available')::numeric DESC), '[]'::jsonb) INTO v_res
  FROM (
    SELECT jsonb_build_object(
      'team_root_user_id', b.team_root_user_id,
      'name', COALESCE(p.full_name, p.email, 'Parceiro'),
      'avatar_url', p.avatar_url,
      'plan_name', (SELECT plan_name FROM public.partner_contracts c WHERE c.user_id=b.team_root_user_id AND c.status='ACTIVE' ORDER BY c.created_at DESC LIMIT 1),
      'members_count', (SELECT COUNT(DISTINCT m.descendant_user_id) FROM public.expansion_team_memberships m
                         WHERE m.ancestor_user_id=_user_id AND m.team_root_user_id=b.team_root_user_id AND m.effective_to IS NULL),
      'points_earned', b.points_earned,
      'points_consumed', b.points_consumed,
      'points_available', b.points_available,
      'week_points', COALESCE((
         SELECT SUM(l.points) FROM public.expansion_team_memberships m2
          JOIN public.expansion_points_ledger l ON l.user_id=m2.descendant_user_id AND l.status='CONFIRMED'
          WHERE m2.ancestor_user_id=_user_id AND m2.team_root_user_id=b.team_root_user_id
            AND l.created_at >= m2.effective_from
            AND (m2.effective_to IS NULL OR l.created_at < m2.effective_to)
            AND (l.created_at AT TIME ZONE 'America/Bahia')::date BETWEEN v_ps AND v_pe),0),
      'share_pct', CASE WHEN v_total>0 THEN ROUND(b.points_available*100.0/v_total,1) ELSE 0 END,
      'is_largest', b.team_root_user_id = v_largest
    ) AS t
    FROM public.expansion_team_balances(_user_id, v_pe) b
    LEFT JOIN public.profiles p ON p.user_id = b.team_root_user_id
  ) s;

  RETURN v_res;
END; $function$;