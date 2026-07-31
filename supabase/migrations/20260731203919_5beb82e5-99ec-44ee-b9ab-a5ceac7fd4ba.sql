CREATE OR REPLACE FUNCTION public.expansion_admin_preview_close(_period_start date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ps DATE; v_pe DATE;
  v_pct NUMERIC; v_caps JSONB;
  v_rows JSONB := '[]'::jsonb;
  v_already INT := 0;
  v_mode TEXT;
  v_cutoff TIMESTAMPTZ;
  v_start_at TIMESTAMPTZ; v_end_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  IF _period_start IS NULL THEN
    SELECT period_start, period_end INTO v_ps, v_pe FROM public.expansion_current_period();
  ELSE
    v_ps := _period_start;
    v_pe := _period_start + 6;
  END IF;

  v_pct  := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_bonus_percent')::numeric, 20);
  v_caps := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_weekly_caps')::jsonb, '{}'::jsonb);

  SELECT COUNT(*) INTO v_already
    FROM public.expansion_period_snapshots
   WHERE period_start = v_ps;

  v_mode := CASE WHEN v_already > 0 THEN 'official' ELSE 'estimate' END;

  -- janela real do período no fuso America/Bahia (respeita o corte oficial na 1a semana)
  v_cutoff  := public.expansion_effective_cutoff();
  v_start_at := (v_ps::timestamp AT TIME ZONE 'America/Bahia');
  IF v_cutoff IS NOT NULL AND v_cutoff > v_start_at AND v_cutoff < ((v_pe + 1)::timestamp AT TIME ZONE 'America/Bahia') THEN
    v_start_at := v_cutoff;
  END IF;
  v_end_at := ((v_pe + 1)::timestamp AT TIME ZONE 'America/Bahia') - INTERVAL '1 second';

  IF v_mode = 'official' THEN
    -- semana já fechada: apenas leitura dos snapshots oficiais (sem recálculo)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'user_id', s.user_id,
             'name', COALESCE(p.full_name, p.email, s.user_id::text),
             'plan_name', s.plan_name,
             'teams_count', s.qualified_teams_count,
             'total_points', COALESCE(s.largest_team_points,0) + COALESCE(s.other_teams_points,0),
             'largest_team_points', s.largest_team_points,
             'other_teams_points', s.other_teams_points,
             'vqe_points', s.vqe_points,
             'payable_vqe_points', s.payable_vqe_points,
             'weekly_cap', COALESCE(s.weekly_cap_value, s.weekly_cap),
             'bonus_percent', s.bonus_percent,
             'cap_applied', (ROUND(COALESCE(s.vqe_points,0) * COALESCE(s.bonus_percent, v_pct) / 100.0, 2) > COALESCE(s.weekly_cap_value, s.weekly_cap, 0)),
             'final_bonus', s.final_bonus,
             'carryforward_points', s.carryforward_points
           ) ORDER BY s.final_bonus DESC NULLS LAST), '[]'::jsonb)
      INTO v_rows
      FROM public.expansion_period_snapshots s
      LEFT JOIN public.profiles p ON p.id = s.user_id
     WHERE s.period_start = v_ps;
  ELSE
    -- semana aberta: estimativa usando o núcleo canônico expansion_compute_week
    WITH c AS (
      SELECT DISTINCT user_id
        FROM public.partner_contracts
       WHERE status = 'ACTIVE'
    ),
    w AS (
      SELECT c.user_id, public.expansion_compute_week(c.user_id, v_pe) AS r
        FROM c
    ),
    f AS (
      SELECT w.user_id, w.r
        FROM w
       WHERE COALESCE((w.r->>'total_points_available')::numeric, 0) > 0
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'user_id', f.user_id,
             'name', COALESCE(p.full_name, p.email, f.user_id::text),
             'plan_name', f.r->>'plan_name',
             'teams_count', (f.r->>'teams_count')::int,
             'total_points', (f.r->>'total_points_available')::numeric,
             'largest_team_points', (f.r->>'largest_team_points')::numeric,
             'other_teams_points', (f.r->>'other_teams_points')::numeric,
             'vqe_points', (f.r->>'vqe_points')::numeric,
             'payable_vqe_points', (f.r->>'payable_vqe_points')::numeric,
             'weekly_cap', (f.r->>'weekly_cap')::numeric,
             'bonus_percent', (f.r->>'bonus_percent')::numeric,
             'cap_applied', (ROUND((f.r->>'vqe_points')::numeric * (f.r->>'bonus_percent')::numeric / 100.0, 2) > COALESCE((f.r->>'weekly_cap')::numeric,0)),
             'final_bonus', (f.r->>'final_bonus')::numeric,
             'carryforward_points', (f.r->>'carryforward_points')::numeric
           ) ORDER BY (f.r->>'final_bonus')::numeric DESC, (f.r->>'total_points_available')::numeric DESC), '[]'::jsonb)
      INTO v_rows
      FROM f
      LEFT JOIN public.profiles p ON p.id = f.user_id;
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'period_start', v_ps,
    'period_end', v_pe,
    'period_start_at', v_start_at,
    'period_end_at', v_end_at,
    'timezone', 'America/Bahia',
    'official_cutoff_at', v_cutoff,
    'bonus_percent', v_pct,
    'weekly_caps', v_caps,
    'already_closed_snapshots', v_already,
    'partners_count', jsonb_array_length(v_rows),
    'partners_with_bonus', (SELECT COUNT(*) FROM jsonb_array_elements(v_rows) e WHERE COALESCE((e->>'final_bonus')::numeric,0) > 0),
    'partners_zero_vqe', (SELECT COUNT(*) FROM jsonb_array_elements(v_rows) e WHERE COALESCE((e->>'vqe_points')::numeric,0) = 0),
    'partners_cap_reached', (SELECT COUNT(*) FROM jsonb_array_elements(v_rows) e WHERE (e->>'cap_applied')::boolean IS TRUE),
    'total_vqe', COALESCE((SELECT SUM((e->>'vqe_points')::numeric) FROM jsonb_array_elements(v_rows) e), 0),
    'total_bonus', COALESCE((SELECT SUM((e->>'final_bonus')::numeric) FROM jsonb_array_elements(v_rows) e), 0),
    'total_carryforward', COALESCE((SELECT SUM((e->>'carryforward_points')::numeric) FROM jsonb_array_elements(v_rows) e), 0),
    'rows', v_rows
  );
END; $function$;

REVOKE ALL ON FUNCTION public.expansion_admin_preview_close(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_preview_close(date) TO authenticated, service_role;