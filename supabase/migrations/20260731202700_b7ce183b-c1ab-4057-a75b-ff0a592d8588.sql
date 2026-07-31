CREATE OR REPLACE FUNCTION public.expansion_admin_preview_close(_period_start date DEFAULT NULL)
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

  WITH c AS (
    SELECT DISTINCT ON (user_id) user_id, id AS contract_id, plan_name
      FROM public.partner_contracts
     WHERE status = 'ACTIVE'
     ORDER BY user_id, COALESCE(is_demo,false) ASC, aporte_value DESC NULLS LAST, created_at ASC
  ),
  b AS (
    SELECT c.user_id, c.plan_name, tb.points_available
      FROM c
      CROSS JOIN LATERAL public.expansion_team_balances(c.user_id, v_pe) tb
     WHERE tb.points_available > 0
  ),
  agg AS (
    SELECT user_id, plan_name,
           COUNT(*)::int AS teams_count,
           SUM(points_available) AS total_points,
           MAX(points_available) AS largest_points
      FROM b
     GROUP BY 1,2
  ),
  calc AS (
    SELECT a.*,
           (a.total_points - a.largest_points) AS other_points,
           LEAST(a.largest_points, a.total_points - a.largest_points) AS vqe_points,
           COALESCE((v_caps ->> COALESCE(a.plan_name,''))::numeric, 0) AS weekly_cap
      FROM agg a
  ),
  fin AS (
    SELECT calc.*,
           ROUND(calc.vqe_points * v_pct / 100.0, 2) AS raw_bonus,
           LEAST(ROUND(calc.vqe_points * v_pct / 100.0, 2), calc.weekly_cap) AS capped_bonus
      FROM calc
  ),
  fin2 AS (
    SELECT fin.*,
           CASE WHEN fin.raw_bonus > 0
                THEN FLOOR(fin.vqe_points * (fin.capped_bonus / fin.raw_bonus))
                ELSE 0 END AS payable_vqe
      FROM fin
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'user_id', f.user_id,
           'name', COALESCE(p.full_name, p.email, f.user_id::text),
           'plan_name', f.plan_name,
           'teams_count', f.teams_count,
           'total_points', f.total_points,
           'largest_team_points', f.largest_points,
           'other_teams_points', f.other_points,
           'vqe_points', f.vqe_points,
           'payable_vqe_points', f.payable_vqe,
           'weekly_cap', f.weekly_cap,
           'bonus_percent', v_pct,
           'cap_applied', (f.raw_bonus > f.weekly_cap),
           'final_bonus', ROUND(f.payable_vqe * v_pct / 100.0, 2),
           'carryforward_points', GREATEST(f.total_points - LEAST(f.payable_vqe * 2, f.total_points), 0)
         ) ORDER BY ROUND(f.payable_vqe * v_pct / 100.0, 2) DESC, f.total_points DESC), '[]'::jsonb)
    INTO v_rows
    FROM fin2 f
    LEFT JOIN public.profiles p ON p.id = f.user_id;

  RETURN jsonb_build_object(
    'period_start', v_ps,
    'period_end', v_pe,
    'bonus_percent', v_pct,
    'weekly_caps', v_caps,
    'already_closed_snapshots', v_already,
    'partners_count', jsonb_array_length(v_rows),
    'partners_with_bonus', (SELECT COUNT(*) FROM jsonb_array_elements(v_rows) e WHERE (e->>'final_bonus')::numeric > 0),
    'total_vqe', COALESCE((SELECT SUM((e->>'vqe_points')::numeric) FROM jsonb_array_elements(v_rows) e), 0),
    'total_bonus', COALESCE((SELECT SUM((e->>'final_bonus')::numeric) FROM jsonb_array_elements(v_rows) e), 0),
    'total_carryforward', COALESCE((SELECT SUM((e->>'carryforward_points')::numeric) FROM jsonb_array_elements(v_rows) e), 0),
    'rows', v_rows
  );
END; $function$;

REVOKE ALL ON FUNCTION public.expansion_admin_preview_close(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expansion_admin_preview_close(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_admin_preview_close(date) TO service_role;