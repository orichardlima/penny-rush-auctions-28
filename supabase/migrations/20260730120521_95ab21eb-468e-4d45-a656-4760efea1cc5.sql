
-- 0) Official start setting (empty = not defined). Does not activate anything.
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES ('expansion_official_start_at', '', 'string', 'Data oficial de inicio do Programa de Expansao por Equipes (vazio = nao definida)')
ON CONFLICT (setting_key) DO NOTHING;

-- helper: current bahia week
CREATE OR REPLACE FUNCTION public.expansion_current_period()
RETURNS TABLE(period_start date, period_end date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT date_trunc('week', public.expansion_bahia_today()::timestamp)::date,
         date_trunc('week', public.expansion_bahia_today()::timestamp)::date + 6
$$;

-- 1) PARTNER OVERVIEW ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_get_partner_overview(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_ps DATE; v_pe DATE;
  v_pct NUMERIC; v_caps JSONB;
  v_contract RECORD; v_cap NUMERIC := 0;
  v_total NUMERIC := 0; v_largest NUMERIC := 0; v_largest_team UUID;
  v_others NUMERIC := 0; v_vqe NUMERIC := 0;
  v_raw NUMERIC := 0; v_final NUMERIC := 0; v_payable NUMERIC := 0;
  v_teams INT := 0; v_week NUMERIC := 0;
  v_snap public.expansion_period_snapshots%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF _user_id <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN RETURN '{}'::jsonb; END IF;

  SELECT period_start, period_end INTO v_ps, v_pe FROM public.expansion_current_period();

  v_pct := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_bonus_percent')::numeric,20);
  v_caps := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_weekly_caps')::jsonb,'{}'::jsonb);

  SELECT id, plan_name INTO v_contract
    FROM public.partner_contracts
   WHERE user_id=_user_id AND status='ACTIVE' AND COALESCE(is_demo,false)=false
   ORDER BY aporte_value DESC NULLS LAST, created_at ASC LIMIT 1;

  v_cap := COALESCE((v_caps ->> COALESCE(v_contract.plan_name,''))::numeric, 0);

  SELECT COALESCE(SUM(points_available),0), COUNT(*)
    INTO v_total, v_teams
    FROM public.expansion_team_balances(_user_id, v_pe) WHERE points_available > 0;

  SELECT team_root_user_id, points_available INTO v_largest_team, v_largest
    FROM public.expansion_team_balances(_user_id, v_pe)
   WHERE points_available > 0
   ORDER BY points_available DESC, team_root_user_id ASC LIMIT 1;
  v_largest := COALESCE(v_largest,0);
  v_others := v_total - v_largest;
  v_vqe := LEAST(v_largest, v_others);

  v_raw := ROUND(v_vqe * v_pct / 100.0, 2);
  v_final := LEAST(v_raw, v_cap);
  IF v_raw > 0 THEN v_payable := FLOOR(v_vqe * (v_final / v_raw)); ELSE v_payable := 0; END IF;
  v_final := ROUND(v_payable * v_pct / 100.0, 2);

  SELECT COALESCE(SUM(l.points),0) INTO v_week
    FROM public.expansion_team_memberships m
    JOIN public.expansion_points_ledger l ON l.user_id=m.descendant_user_id AND l.status='CONFIRMED'
   WHERE m.ancestor_user_id=_user_id AND l.created_at::date BETWEEN v_ps AND v_pe;

  SELECT * INTO v_snap FROM public.expansion_period_snapshots
   WHERE user_id=_user_id ORDER BY period_start DESC LIMIT 1;

  RETURN jsonb_build_object(
    'period_start', v_ps, 'period_end', v_pe,
    'next_close_date', v_pe + 1,
    'teams_count', v_teams,
    'total_points_available', v_total,
    'week_points', v_week,
    'largest_team_user_id', v_largest_team,
    'largest_team_points', v_largest,
    'other_teams_points', v_others,
    'vqe_available', v_vqe,
    'vqe_payable', v_payable,
    'bonus_percent', v_pct,
    'weekly_cap', v_cap,
    'estimated_bonus', v_final,
    'carryforward_points', GREATEST(v_total - LEAST(v_payable*2, v_total), 0),
    'plan_name', v_contract.plan_name,
    'has_active_contract', v_contract.id IS NOT NULL,
    'last_snapshot', CASE WHEN v_snap.id IS NULL THEN NULL ELSE jsonb_build_object(
        'period_start', v_snap.period_start, 'period_end', v_snap.period_end,
        'status_official', v_snap.status_official, 'final_bonus', v_snap.final_bonus,
        'released_at', v_snap.released_at) END,
    'program', jsonb_build_object(
      'points_generation_enabled', COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_points_generation_enabled'),'false')::boolean,
      'weekly_close_enabled', COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_weekly_close_enabled'),'false')::boolean,
      'payout_enabled', COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_bonus_payout_enabled'),'false')::boolean,
      'official_start_at', NULLIF((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_official_start_at'),'')
    )
  );
END; $$;

-- 2) PARTNER TEAMS ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_get_partner_teams(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
      'members_count', (SELECT COUNT(DISTINCT m.descendant_user_id) FROM public.expansion_team_memberships m WHERE m.ancestor_user_id=_user_id AND m.team_root_user_id=b.team_root_user_id),
      'points_earned', b.points_earned,
      'points_consumed', b.points_consumed,
      'points_available', b.points_available,
      'week_points', COALESCE((
         SELECT SUM(l.points) FROM public.expansion_team_memberships m2
          JOIN public.expansion_points_ledger l ON l.user_id=m2.descendant_user_id AND l.status='CONFIRMED'
          WHERE m2.ancestor_user_id=_user_id AND m2.team_root_user_id=b.team_root_user_id
            AND l.created_at::date BETWEEN v_ps AND v_pe),0),
      'share_pct', CASE WHEN v_total>0 THEN ROUND(b.points_available*100.0/v_total,1) ELSE 0 END,
      'is_largest', b.team_root_user_id = v_largest
    ) AS t
    FROM public.expansion_team_balances(_user_id, v_pe) b
    LEFT JOIN public.profiles p ON p.user_id = b.team_root_user_id
  ) s;

  RETURN v_res;
END; $$;

-- 3) PARTNER SNAPSHOT HISTORY -------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_get_partner_snapshots(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_res JSONB;
BEGIN
  IF _user_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF _user_id <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'period_start') DESC), '[]'::jsonb) INTO v_res
  FROM (
    SELECT jsonb_build_object(
      'id', s.id, 'period_start', s.period_start, 'period_end', s.period_end,
      'plan_name', s.plan_name, 'weekly_cap', s.weekly_cap_value,
      'largest_team_points', s.largest_team_points, 'other_teams_points', s.other_teams_points,
      'largest_team_name', COALESCE(pl.full_name, pl.email),
      'vqe_points', s.vqe_points, 'payable_vqe_points', s.payable_vqe_points,
      'bonus_percent', s.bonus_percent, 'final_bonus', s.final_bonus,
      'total_points_consumed', s.total_points_consumed, 'carryforward_points', s.carryforward_points,
      'status_official', s.status_official, 'closed_at', s.closed_at, 'released_at', s.released_at,
      'balances_before', s.balances_before, 'balances_after', s.balances_after,
      'consumptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'team_root_user_id', c.team_root_user_id,
          'team_name', COALESCE(pt.full_name, pt.email, 'Equipe'),
          'role', c.role, 'points_available', c.points_available,
          'points_consumed', c.points_consumed, 'balance_after', c.balance_after)
          ORDER BY c.points_consumed DESC)
        FROM public.expansion_team_consumptions c
        LEFT JOIN public.profiles pt ON pt.user_id = c.team_root_user_id
        WHERE c.snapshot_id = s.id), '[]'::jsonb)
    ) x
    FROM public.expansion_period_snapshots s
    LEFT JOIN public.profiles pl ON pl.user_id = s.largest_team_user_id
    WHERE s.user_id = _user_id
  ) q;

  RETURN v_res;
END; $$;

-- 4) ADMIN OVERVIEW -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ps DATE; v_pe DATE;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT period_start, period_end INTO v_ps, v_pe FROM public.expansion_current_period();

  RETURN jsonb_build_object(
    'settings', (SELECT jsonb_object_agg(setting_key, setting_value) FROM public.system_settings WHERE setting_key LIKE 'expansion%'),
    'current_period_start', v_ps, 'current_period_end', v_pe, 'next_close_date', v_pe + 1,
    'last_closed_week', public.expansion_last_closed_week(),
    'partners_with_teams', (SELECT COUNT(DISTINCT ancestor_user_id) FROM public.expansion_team_memberships),
    'teams_total', (SELECT COUNT(*) FROM (SELECT DISTINCT ancestor_user_id, team_root_user_id FROM public.expansion_team_memberships) z),
    'points_available_total', (SELECT COALESCE(SUM(points),0) FROM public.expansion_points_ledger WHERE status='CONFIRMED')
       - (SELECT COALESCE(SUM(points_consumed),0) FROM public.expansion_team_consumptions),
    'vqe_total', (SELECT COALESCE(SUM(vqe_points),0) FROM public.expansion_period_snapshots),
    'bonus_pending_release', (SELECT COALESCE(SUM(final_bonus),0) FROM public.expansion_period_snapshots WHERE status_official='closed'),
    'bonus_released', (SELECT COALESCE(SUM(final_bonus),0) FROM public.expansion_period_snapshots WHERE status_official='released'),
    'snapshots_closed_count', (SELECT COUNT(*) FROM public.expansion_period_snapshots WHERE status_official='closed'),
    'recent_errors', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'period_start',period_start,'status',status,'error_message',error_message,'started_at',started_at) ORDER BY started_at DESC)
        FROM (SELECT * FROM public.expansion_close_runs WHERE COALESCE(error_count,0)>0 OR status='ERROR' ORDER BY started_at DESC LIMIT 5) e), '[]'::jsonb)
  );
END; $$;

-- 5) ADMIN PERIODS ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_periods()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_res JSONB;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'period_start') DESC), '[]'::jsonb) INTO v_res FROM (
    SELECT jsonb_build_object(
      'period_start', s.period_start, 'period_end', s.period_end,
      'snapshots', COUNT(*), 
      'closed', COUNT(*) FILTER (WHERE s.status_official='closed'),
      'released', COUNT(*) FILTER (WHERE s.status_official='released'),
      'vqe_total', COALESCE(SUM(s.vqe_points),0),
      'bonus_total', COALESCE(SUM(s.final_bonus),0),
      'bonus_released_total', COALESCE(SUM(s.final_bonus) FILTER (WHERE s.status_official='released'),0),
      'run', (SELECT jsonb_build_object('run_id',r.id,'origin',r.origin,'status',r.status,
                 'eligible_count',r.eligible_count,'processed_count',r.processed_count,'closed_count',r.closed_count,
                 'already_closed_count',r.already_closed_count,'no_volume_count',r.no_volume_count,'error_count',r.error_count,
                 'started_at',r.started_at,'finished_at',r.finished_at)
              FROM public.expansion_close_runs r WHERE r.period_start=s.period_start ORDER BY r.started_at DESC LIMIT 1)
    ) x
    FROM public.expansion_period_snapshots s
    GROUP BY s.period_start, s.period_end
  ) q;
  RETURN v_res;
END; $$;

-- 6) ADMIN SNAPSHOTS ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_snapshots(_period_start date DEFAULT NULL, _search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_res JSONB;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'final_bonus')::numeric DESC), '[]'::jsonb) INTO v_res FROM (
    SELECT jsonb_build_object(
      'id', s.id, 'user_id', s.user_id,
      'partner_name', COALESCE(p.full_name, p.email, 'Parceiro'),
      'period_start', s.period_start, 'period_end', s.period_end,
      'contract_id', s.active_contract_id, 'plan_name', s.plan_name, 'weekly_cap', s.weekly_cap_value,
      'largest_team_points', s.largest_team_points, 'other_teams_points', s.other_teams_points,
      'vqe_points', s.vqe_points, 'payable_vqe_points', s.payable_vqe_points,
      'bonus_percent', s.bonus_percent, 'final_bonus', s.final_bonus,
      'total_points_consumed', s.total_points_consumed, 'carryforward_points', s.carryforward_points,
      'status_official', s.status_official, 'closed_at', s.closed_at, 'released_at', s.released_at,
      'payout_reference', s.payout_reference,
      'consumptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('team_root_user_id',c.team_root_user_id,
          'team_name', COALESCE(pt.full_name, pt.email,'Equipe'), 'role',c.role,
          'points_available',c.points_available,'points_consumed',c.points_consumed,'balance_after',c.balance_after)
          ORDER BY c.points_consumed DESC)
        FROM public.expansion_team_consumptions c
        LEFT JOIN public.profiles pt ON pt.user_id=c.team_root_user_id
        WHERE c.snapshot_id=s.id),'[]'::jsonb)
    ) x
    FROM public.expansion_period_snapshots s
    LEFT JOIN public.profiles p ON p.user_id = s.user_id
    WHERE (_period_start IS NULL OR s.period_start=_period_start)
      AND (_search IS NULL OR _search='' OR COALESCE(p.full_name,'') ILIKE '%'||_search||'%' OR COALESCE(p.email,'') ILIKE '%'||_search||'%')
  ) q;
  RETURN v_res;
END; $$;

-- 7) ADMIN RUNS ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_runs(_period_start date DEFAULT NULL, _origin text DEFAULT NULL, _status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_res JSONB;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'period_start', r.period_start, 'period_end', r.period_end,
    'origin', r.origin, 'admin_id', r.admin_id,
    'admin_name', COALESCE(p.full_name, p.email),
    'reason', r.reason, 'started_at', r.started_at, 'finished_at', r.finished_at,
    'eligible_count', r.eligible_count, 'processed_count', r.processed_count,
    'closed_count', r.closed_count, 'already_closed_count', r.already_closed_count,
    'no_volume_count', r.no_volume_count, 'error_count', r.error_count,
    'status', r.status, 'error_message', r.error_message) ORDER BY r.started_at DESC), '[]'::jsonb)
  INTO v_res
  FROM public.expansion_close_runs r
  LEFT JOIN public.profiles p ON p.user_id = r.admin_id
  WHERE (_period_start IS NULL OR r.period_start=_period_start)
    AND (_origin IS NULL OR _origin='' OR r.origin=_origin)
    AND (_status IS NULL OR _status='' OR r.status=_status);
  RETURN v_res;
END; $$;

-- 8) ADMIN ADJUSTMENTS / REVERSALS -------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_adjustments(_limit int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_res JSONB;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'created_at', l.created_at,
    'user_id', l.user_id, 'partner_name', COALESCE(p.full_name, p.email,'Parceiro'),
    'points', l.points, 'source', l.source, 'source_ref', l.source_ref,
    'status', l.status, 'reverses_id', l.reverses_id, 'reason', l.reason,
    'admin_name', COALESCE(a.full_name, a.email),
    'plan_name', l.plan_name, 'contract_id', l.contract_id,
    'kind', CASE WHEN l.reverses_id IS NOT NULL OR l.points < 0 THEN 'REVERSAL' ELSE 'ADJUSTMENT' END
  ) ORDER BY l.created_at DESC), '[]'::jsonb) INTO v_res
  FROM (
    SELECT * FROM public.expansion_points_ledger
    WHERE reverses_id IS NOT NULL OR points < 0 OR status <> 'CONFIRMED' OR admin_id IS NOT NULL
    ORDER BY created_at DESC LIMIT COALESCE(_limit,200)
  ) l
  LEFT JOIN public.profiles p ON p.user_id = l.user_id
  LEFT JOIN public.profiles a ON a.user_id = l.admin_id;
  RETURN v_res;
END; $$;

-- 9) ADMIN AUDIT --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_audit_log(_limit int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_res JSONB;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'created_at', a.created_at, 'action', a.action,
    'admin_name', COALESCE(p.full_name, p.email), 'target_type', a.target_type,
    'target_id', a.target_id, 'reason', a.reason,
    'before_value', a.before_value, 'after_value', a.after_value) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_res FROM (
    SELECT * FROM public.expansion_admin_audit ORDER BY created_at DESC LIMIT COALESCE(_limit,200)
  ) a LEFT JOIN public.profiles p ON p.user_id = a.admin_id;
  RETURN v_res;
END; $$;

-- 10) ADMIN SETTINGS UPDATE ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.expansion_admin_update_settings(_settings jsonb, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_key TEXT; v_val TEXT; v_before JSONB := '{}'::jsonb; v_old TEXT;
  v_allowed TEXT[] := ARRAY['expansion_bonus_percent','expansion_weekly_caps','expansion_official_start_at',
                            'expansion_weekly_close_enabled','expansion_bonus_payout_enabled'];
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  FOR v_key, v_val IN SELECT key, value #>> '{}' FROM jsonb_each(_settings) LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'setting not allowed: %', v_key;
    END IF;
    SELECT setting_value INTO v_old FROM public.system_settings WHERE setting_key=v_key;
    v_before := v_before || jsonb_build_object(v_key, v_old);
    INSERT INTO public.system_settings (setting_key, setting_value, setting_type)
    VALUES (v_key, COALESCE(v_val,''), 'string')
    ON CONFLICT (setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value, updated_at=now();
  END LOOP;

  INSERT INTO public.expansion_admin_audit (admin_id, action, target_type, target_id, before_value, after_value, reason)
  VALUES (auth.uid(), 'UPDATE_SETTINGS', 'system_settings', 'expansion', v_before, _settings, _reason);

  RETURN jsonb_build_object('status','OK','updated', _settings);
END; $$;

REVOKE EXECUTE ON FUNCTION public.expansion_admin_overview(), public.expansion_admin_periods(),
  public.expansion_admin_snapshots(date,text), public.expansion_admin_runs(date,text,text),
  public.expansion_admin_adjustments(int), public.expansion_admin_audit_log(int),
  public.expansion_admin_update_settings(jsonb,text) FROM anon;

GRANT EXECUTE ON FUNCTION public.expansion_current_period(), public.expansion_get_partner_overview(uuid),
  public.expansion_get_partner_teams(uuid), public.expansion_get_partner_snapshots(uuid),
  public.expansion_admin_overview(), public.expansion_admin_periods(),
  public.expansion_admin_snapshots(date,text), public.expansion_admin_runs(date,text,text),
  public.expansion_admin_adjustments(int), public.expansion_admin_audit_log(int),
  public.expansion_admin_update_settings(jsonb,text) TO authenticated;
