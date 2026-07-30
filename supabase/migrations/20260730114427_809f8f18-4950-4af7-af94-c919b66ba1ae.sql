
ALTER TABLE public.expansion_period_snapshots
  ADD COLUMN IF NOT EXISTS status_official TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS active_contract_id UUID,
  ADD COLUMN IF NOT EXISTS plan_name TEXT,
  ADD COLUMN IF NOT EXISTS weekly_cap_value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS largest_team_user_id UUID,
  ADD COLUMN IF NOT EXISTS largest_team_points NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_teams_points NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vqe_points NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payable_vqe_points NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_percent NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_bonus NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points_consumed NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carryforward_points NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balances_before JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS balances_after JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS run_id UUID,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_reference UUID;

CREATE TABLE IF NOT EXISTS public.expansion_team_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.expansion_period_snapshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  team_root_user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  role TEXT NOT NULL,
  points_available NUMERIC NOT NULL DEFAULT 0,
  points_consumed NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, team_root_user_id)
);
GRANT SELECT ON public.expansion_team_consumptions TO authenticated;
GRANT ALL ON public.expansion_team_consumptions TO service_role;
ALTER TABLE public.expansion_team_consumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own or admin read consumptions" ON public.expansion_team_consumptions;
CREATE POLICY "own or admin read consumptions" ON public.expansion_team_consumptions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_exp_cons_user_period ON public.expansion_team_consumptions(user_id, period_start);

CREATE TABLE IF NOT EXISTS public.expansion_close_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE,
  period_end DATE,
  origin TEXT NOT NULL DEFAULT 'CRON',
  admin_id UUID,
  reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  eligible_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  closed_count INTEGER NOT NULL DEFAULT 0,
  already_closed_count INTEGER NOT NULL DEFAULT 0,
  no_volume_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expansion_close_runs TO authenticated;
GRANT ALL ON public.expansion_close_runs TO service_role;
ALTER TABLE public.expansion_close_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read close runs" ON public.expansion_close_runs;
CREATE POLICY "admin read close runs" ON public.expansion_close_runs
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES
  ('expansion_weekly_close_enabled','false','boolean','Permite que o cron execute o fechamento semanal do Bonus de Expansao'),
  ('expansion_bonus_percent','20','number','Percentual do VQE pago como Bonus de Expansao'),
  ('expansion_weekly_caps','{"START":80,"PRO":250,"ELITE":500,"Master":800,"Legend":2000,"Diamond":5000,"Fundador":0,"Teste":0}','json','Teto semanal (R$) do Bonus de Expansao por plano')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.expansion_bahia_today()
RETURNS DATE LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE 'America/Bahia')::date;
$$;

CREATE OR REPLACE FUNCTION public.expansion_last_closed_week()
RETURNS DATE LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (date_trunc('week', public.expansion_bahia_today())::date - 7);
$$;

CREATE OR REPLACE FUNCTION public.expansion_team_balances(_user_id UUID, _period_end DATE)
RETURNS TABLE (team_root_user_id UUID, points_earned NUMERIC, points_consumed NUMERIC, points_available NUMERIC)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH earned AS (
    SELECT m.team_root_user_id AS team, SUM(l.points)::numeric AS pts
      FROM public.expansion_team_memberships m
      JOIN public.expansion_points_ledger l ON l.user_id = m.descendant_user_id
     WHERE m.ancestor_user_id = _user_id
       AND l.status = 'CONFIRMED'
       AND (l.created_at AT TIME ZONE 'America/Bahia')::date <= _period_end
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
$$;

CREATE OR REPLACE FUNCTION public.expansion_close_partner_week(
  _user_id UUID, _period_start DATE, _run_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period_end DATE := _period_start + 6;
  v_snapshot public.expansion_period_snapshots%ROWTYPE;
  v_pct NUMERIC;
  v_caps JSONB;
  v_contract RECORD;
  v_cap NUMERIC := 0;
  v_largest NUMERIC := 0;
  v_largest_team UUID;
  v_total NUMERIC := 0;
  v_others NUMERIC := 0;
  v_vqe NUMERIC := 0;
  v_bonus_raw NUMERIC := 0;
  v_final NUMERIC := 0;
  v_payable NUMERIC := 0;
  v_snap_id UUID;
  v_before JSONB := '{}'::jsonb;
  v_after JSONB := '{}'::jsonb;
  v_alloc NUMERIC := 0;
  v_rem NUMERIC := 0;
  r RECORD;
  v_shares JSONB := '{}'::jsonb;
  v_total_consumed NUMERIC := 0;
BEGIN
  IF _period_start <> date_trunc('week', _period_start::timestamp)::date THEN
    RAISE EXCEPTION 'period_start must be a Monday';
  END IF;
  IF v_period_end >= public.expansion_bahia_today() THEN
    RAISE EXCEPTION 'week not finished yet';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('exp_close:'||_user_id::text||':'||_period_start::text,0));

  SELECT * INTO v_snapshot FROM public.expansion_period_snapshots
   WHERE user_id=_user_id AND period_start=_period_start AND period_end=v_period_end;
  IF FOUND AND v_snapshot.status_official IN ('closed','released') THEN
    RETURN jsonb_build_object('status','ALREADY_CLOSED','snapshot_id',v_snapshot.id,
      'user_id',_user_id,'final_bonus',v_snapshot.final_bonus,'period_start',_period_start);
  END IF;

  v_pct := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_bonus_percent')::numeric,20);
  v_caps := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_weekly_caps')::jsonb,'{}'::jsonb);

  SELECT id, plan_name INTO v_contract
    FROM public.partner_contracts
   WHERE user_id=_user_id AND status='ACTIVE' AND COALESCE(is_demo,false)=false
   ORDER BY aporte_value DESC NULLS LAST, created_at ASC LIMIT 1;

  v_cap := COALESCE((v_caps ->> COALESCE(v_contract.plan_name,''))::numeric, 0);

  CREATE TEMP TABLE IF NOT EXISTS _exp_bal (team UUID, avail NUMERIC) ON COMMIT DROP;
  DELETE FROM _exp_bal;
  INSERT INTO _exp_bal
  SELECT team_root_user_id, points_available
    FROM public.expansion_team_balances(_user_id, v_period_end)
   WHERE points_available > 0;

  SELECT COALESCE(SUM(avail),0) INTO v_total FROM _exp_bal;
  SELECT team, avail INTO v_largest_team, v_largest FROM _exp_bal ORDER BY avail DESC, team ASC LIMIT 1;
  v_largest := COALESCE(v_largest,0);
  v_others := v_total - v_largest;
  v_vqe := LEAST(v_largest, v_others);

  v_bonus_raw := ROUND(v_vqe * v_pct / 100.0, 2);
  v_final := LEAST(v_bonus_raw, v_cap);
  IF v_bonus_raw > 0 THEN
    v_payable := FLOOR(v_vqe * (v_final / v_bonus_raw));
  ELSE
    v_payable := 0;
  END IF;
  v_final := ROUND(v_payable * v_pct / 100.0, 2);

  SELECT COALESCE(jsonb_object_agg(team::text, avail),'{}'::jsonb) INTO v_before FROM _exp_bal;

  INSERT INTO public.expansion_period_snapshots
    (user_id, period_start, period_end, personal_points, organizational_points, points_by_team,
     qualified_teams_count, weekly_cap, status_official, active_contract_id, plan_name,
     weekly_cap_value, largest_team_user_id, largest_team_points, other_teams_points,
     vqe_points, payable_vqe_points, bonus_percent, final_bonus, balances_before, run_id, closed_at)
  VALUES (_user_id, _period_start, v_period_end, 0, v_total, v_before,
     (SELECT COUNT(*) FROM _exp_bal), v_cap, 'closed', v_contract.id, v_contract.plan_name,
     v_cap, v_largest_team, v_largest, v_others, v_vqe, v_payable, v_pct, v_final, v_before, _run_id, now())
  ON CONFLICT (user_id, period_start, period_end) DO UPDATE SET
     organizational_points=EXCLUDED.organizational_points, points_by_team=EXCLUDED.points_by_team,
     qualified_teams_count=EXCLUDED.qualified_teams_count, weekly_cap=EXCLUDED.weekly_cap,
     status_official='closed', active_contract_id=EXCLUDED.active_contract_id, plan_name=EXCLUDED.plan_name,
     weekly_cap_value=EXCLUDED.weekly_cap_value, largest_team_user_id=EXCLUDED.largest_team_user_id,
     largest_team_points=EXCLUDED.largest_team_points, other_teams_points=EXCLUDED.other_teams_points,
     vqe_points=EXCLUDED.vqe_points, payable_vqe_points=EXCLUDED.payable_vqe_points,
     bonus_percent=EXCLUDED.bonus_percent, final_bonus=EXCLUDED.final_bonus,
     balances_before=EXCLUDED.balances_before, run_id=EXCLUDED.run_id, closed_at=now()
  RETURNING id INTO v_snap_id;

  IF v_payable > 0 AND v_largest_team IS NOT NULL THEN
    INSERT INTO public.expansion_team_consumptions
      (snapshot_id, user_id, team_root_user_id, period_start, period_end, role,
       points_available, points_consumed, balance_after)
    VALUES (v_snap_id, _user_id, v_largest_team, _period_start, v_period_end, 'LARGEST',
       v_largest, v_payable, v_largest - v_payable);
    v_total_consumed := v_payable;

    v_alloc := 0;
    FOR r IN
      SELECT team, FLOOR(v_payable * avail / NULLIF(v_others,0)) AS base
        FROM _exp_bal WHERE team <> v_largest_team
    LOOP
      v_shares := v_shares || jsonb_build_object(r.team::text, r.base);
      v_alloc := v_alloc + r.base;
    END LOOP;
    v_rem := v_payable - v_alloc;
    FOR r IN
      SELECT team,
             (v_payable * avail / NULLIF(v_others,0)) - FLOOR(v_payable * avail / NULLIF(v_others,0)) AS frac
        FROM _exp_bal WHERE team <> v_largest_team ORDER BY frac DESC, team ASC
    LOOP
      EXIT WHEN v_rem <= 0;
      v_shares := jsonb_set(v_shares, ARRAY[r.team::text], to_jsonb((v_shares->>r.team::text)::numeric + 1));
      v_rem := v_rem - 1;
    END LOOP;

    FOR r IN SELECT team, avail FROM _exp_bal WHERE team <> v_largest_team LOOP
      INSERT INTO public.expansion_team_consumptions
        (snapshot_id, user_id, team_root_user_id, period_start, period_end, role,
         points_available, points_consumed, balance_after)
      VALUES (v_snap_id, _user_id, r.team, _period_start, v_period_end, 'OTHER',
         r.avail, COALESCE((v_shares->>r.team::text)::numeric,0),
         r.avail - COALESCE((v_shares->>r.team::text)::numeric,0));
      v_total_consumed := v_total_consumed + COALESCE((v_shares->>r.team::text)::numeric,0);
    END LOOP;
  END IF;

  SELECT COALESCE(jsonb_object_agg(team_root_user_id::text, points_available),'{}'::jsonb)
    INTO v_after
    FROM public.expansion_team_balances(_user_id, v_period_end)
   WHERE points_available <> 0;

  UPDATE public.expansion_period_snapshots
     SET balances_after = v_after,
         total_points_consumed = v_total_consumed,
         carryforward_points = (SELECT COALESCE(SUM(points_available),0)
                                  FROM public.expansion_team_balances(_user_id, v_period_end))
   WHERE id = v_snap_id;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_final > 0 THEN 'CLOSED' ELSE 'CLOSED_NO_VOLUME' END,
    'snapshot_id', v_snap_id, 'user_id', _user_id,
    'period_start', _period_start, 'period_end', v_period_end,
    'plan_name', v_contract.plan_name, 'weekly_cap', v_cap,
    'largest_team_points', v_largest, 'other_teams_points', v_others,
    'vqe_points', v_vqe, 'payable_vqe_points', v_payable,
    'bonus_percent', v_pct, 'final_bonus', v_final,
    'total_points_consumed', v_total_consumed,
    'balances_before', v_before, 'balances_after', v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.expansion_run_weekly_close(
  _period_start DATE DEFAULT NULL,
  _origin TEXT DEFAULT 'CRON',
  _admin_id UUID DEFAULT NULL,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period DATE := COALESCE(_period_start, public.expansion_last_closed_week());
  v_end DATE;
  v_run UUID;
  v_enabled BOOLEAN;
  r RECORD;
  res JSONB;
  v_eligible INT := 0; v_processed INT := 0; v_closed INT := 0;
  v_already INT := 0; v_novol INT := 0; v_err INT := 0;
  v_details JSONB := '[]'::jsonb;
BEGIN
  v_end := v_period + 6;

  IF _origin = 'CRON' THEN
    v_enabled := COALESCE((SELECT setting_value FROM public.system_settings
                            WHERE setting_key='expansion_weekly_close_enabled') = 'true', false);
    IF NOT v_enabled THEN
      INSERT INTO public.expansion_close_runs
        (period_start, period_end, origin, status, finished_at, reason)
      VALUES (v_period, v_end, 'CRON', 'SKIPPED_DISABLED', now(), 'expansion_weekly_close_enabled = false')
      RETURNING id INTO v_run;
      RETURN jsonb_build_object('status','SKIPPED_DISABLED','run_id',v_run,'period_start',v_period);
    END IF;
  END IF;

  IF v_end >= public.expansion_bahia_today() THEN
    RAISE EXCEPTION 'cannot close an open week (% a %)', v_period, v_end;
  END IF;

  INSERT INTO public.expansion_close_runs (period_start, period_end, origin, admin_id, reason, status)
  VALUES (v_period, v_end, _origin, _admin_id, _reason, 'RUNNING') RETURNING id INTO v_run;

  FOR r IN
    SELECT DISTINCT pc.user_id
      FROM public.partner_contracts pc
     WHERE pc.status='ACTIVE' AND COALESCE(pc.is_demo,false)=false
  LOOP
    v_eligible := v_eligible + 1;
    BEGIN
      res := public.expansion_close_partner_week(r.user_id, v_period, v_run);
      v_processed := v_processed + 1;
      IF res->>'status' = 'ALREADY_CLOSED' THEN v_already := v_already + 1;
      ELSIF res->>'status' = 'CLOSED_NO_VOLUME' THEN v_novol := v_novol + 1; v_closed := v_closed + 1;
      ELSE v_closed := v_closed + 1;
      END IF;
      IF COALESCE((res->>'final_bonus')::numeric,0) > 0 OR res->>'status'='ALREADY_CLOSED' THEN
        v_details := v_details || jsonb_build_array(res);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_err := v_err + 1;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'status','ERROR','user_id',r.user_id,'error',SQLERRM));
    END;
  END LOOP;

  UPDATE public.expansion_close_runs
     SET finished_at=now(), eligible_count=v_eligible, processed_count=v_processed,
         closed_count=v_closed, already_closed_count=v_already, no_volume_count=v_novol,
         error_count=v_err, status=CASE WHEN v_err>0 THEN 'COMPLETED_WITH_ERRORS' ELSE 'COMPLETED' END,
         details=v_details
   WHERE id=v_run;

  RETURN jsonb_build_object('status','COMPLETED','run_id',v_run,'period_start',v_period,'period_end',v_end,
    'eligible',v_eligible,'processed',v_processed,'closed',v_closed,'already_closed',v_already,
    'no_volume',v_novol,'errors',v_err);
END;
$$;

CREATE OR REPLACE FUNCTION public.expansion_admin_close_week(_period_start DATE, _reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res JSONB;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  IF _period_start IS NULL THEN RAISE EXCEPTION 'period_start is required'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'reason is required'; END IF;

  v_res := public.expansion_run_weekly_close(_period_start, 'ADMIN', auth.uid(), _reason);

  INSERT INTO public.expansion_admin_audit (admin_id, action, target_type, target_id, after_value, reason)
  VALUES (auth.uid(),'weekly_close','expansion_period',_period_start::text, v_res, _reason);

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.expansion_close_partner_week(UUID,DATE,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_run_weekly_close(DATE,TEXT,UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expansion_admin_close_week(DATE,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_team_balances(UUID,DATE) TO authenticated, service_role;
