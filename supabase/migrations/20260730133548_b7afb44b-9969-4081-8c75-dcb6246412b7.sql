
-- ============================================================
-- 1) FLAGS
-- ============================================================
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES
  ('expansion_auto_release_enabled','true','boolean','Libera automaticamente os bônus dos snapshots fechados'),
  ('expansion_structural_lock_enabled','true','boolean','Bloqueia alterações estruturais de patrocínio/rede até o versionamento temporal das memberships')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

UPDATE public.system_settings SET setting_value='true' WHERE setting_key='expansion_bonus_payout_enabled';

INSERT INTO public.expansion_admin_audit (admin_id, action, target_type, target_id, before_value, after_value, reason)
VALUES (NULL,'update_settings','system_settings','expansion_activation',
  jsonb_build_object('expansion_bonus_payout_enabled','false','expansion_auto_release_enabled',NULL),
  jsonb_build_object('expansion_bonus_payout_enabled','true','expansion_auto_release_enabled','true','expansion_structural_lock_enabled','true'),
  'Ativação operacional definitiva do Programa de Expansão');

-- ============================================================
-- 2) NÚCLEO CANÔNICO DE CÁLCULO
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_compute_week(_user_id uuid, _period_end date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pct NUMERIC; v_caps JSONB; v_contract RECORD;
  v_cap NUMERIC := 0; v_total NUMERIC := 0; v_teams INT := 0;
  v_largest NUMERIC := 0; v_largest_team UUID; v_others NUMERIC := 0;
  v_vqe NUMERIC := 0; v_raw NUMERIC := 0; v_final NUMERIC := 0; v_payable NUMERIC := 0;
  v_balances JSONB := '{}'::jsonb;
BEGIN
  v_pct  := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_bonus_percent')::numeric,20);
  v_caps := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_weekly_caps')::jsonb,'{}'::jsonb);

  SELECT id, plan_name INTO v_contract
    FROM public.partner_contracts
   WHERE user_id=_user_id AND status='ACTIVE'
   ORDER BY COALESCE(is_demo,false) ASC, aporte_value DESC NULLS LAST, created_at ASC
   LIMIT 1;

  v_cap := COALESCE((v_caps ->> COALESCE(v_contract.plan_name,''))::numeric, 0);

  SELECT COALESCE(SUM(points_available),0), COUNT(*),
         COALESCE(jsonb_object_agg(team_root_user_id::text, points_available),'{}'::jsonb)
    INTO v_total, v_teams, v_balances
    FROM public.expansion_team_balances(_user_id, _period_end)
   WHERE points_available > 0;

  SELECT team_root_user_id, points_available INTO v_largest_team, v_largest
    FROM public.expansion_team_balances(_user_id, _period_end)
   WHERE points_available > 0
   ORDER BY points_available DESC, team_root_user_id ASC LIMIT 1;

  v_largest := COALESCE(v_largest,0);
  v_others  := v_total - v_largest;
  v_vqe     := LEAST(v_largest, v_others);

  v_raw := ROUND(v_vqe * v_pct / 100.0, 2);
  v_final := LEAST(v_raw, v_cap);
  IF v_raw > 0 THEN v_payable := FLOOR(v_vqe * (v_final / v_raw)); ELSE v_payable := 0; END IF;
  v_final := ROUND(v_payable * v_pct / 100.0, 2);

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'period_end', _period_end,
    'active_contract_id', v_contract.id,
    'plan_name', v_contract.plan_name,
    'weekly_cap', v_cap,
    'teams_count', v_teams,
    'total_points_available', v_total,
    'largest_team_user_id', v_largest_team,
    'largest_team_points', v_largest,
    'other_teams_points', v_others,
    'vqe_points', v_vqe,
    'payable_vqe_points', v_payable,
    'bonus_percent', v_pct,
    'final_bonus', v_final,
    'carryforward_points', GREATEST(v_total - LEAST(v_payable*2, v_total), 0),
    'balances', v_balances
  );
END; $$;

REVOKE ALL ON FUNCTION public.expansion_compute_week(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_compute_week(uuid,date) TO authenticated;

-- ============================================================
-- 3) FECHAMENTO USANDO O NÚCLEO CANÔNICO
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_close_partner_week(_user_id uuid, _period_start date, _run_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period_end DATE := _period_start + 6;
  v_snapshot public.expansion_period_snapshots%ROWTYPE;
  v_core JSONB;
  v_pct NUMERIC; v_cap NUMERIC; v_largest NUMERIC; v_largest_team UUID;
  v_total NUMERIC; v_others NUMERIC; v_vqe NUMERIC; v_final NUMERIC; v_payable NUMERIC;
  v_contract_id UUID; v_plan TEXT; v_teams INT;
  v_snap_id UUID; v_before JSONB; v_after JSONB := '{}'::jsonb;
  v_alloc NUMERIC := 0; v_rem NUMERIC := 0; r RECORD;
  v_shares JSONB := '{}'::jsonb; v_total_consumed NUMERIC := 0;
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

  v_core := public.expansion_compute_week(_user_id, v_period_end);

  v_pct          := (v_core->>'bonus_percent')::numeric;
  v_cap          := (v_core->>'weekly_cap')::numeric;
  v_total        := (v_core->>'total_points_available')::numeric;
  v_teams        := (v_core->>'teams_count')::int;
  v_largest      := (v_core->>'largest_team_points')::numeric;
  v_largest_team := NULLIF(v_core->>'largest_team_user_id','')::uuid;
  v_others       := (v_core->>'other_teams_points')::numeric;
  v_vqe          := (v_core->>'vqe_points')::numeric;
  v_payable      := (v_core->>'payable_vqe_points')::numeric;
  v_final        := (v_core->>'final_bonus')::numeric;
  v_contract_id  := NULLIF(v_core->>'active_contract_id','')::uuid;
  v_plan         := v_core->>'plan_name';
  v_before       := COALESCE(v_core->'balances','{}'::jsonb);

  CREATE TEMP TABLE IF NOT EXISTS _exp_bal (team UUID, avail NUMERIC) ON COMMIT DROP;
  DELETE FROM _exp_bal;
  INSERT INTO _exp_bal
  SELECT team_root_user_id, points_available
    FROM public.expansion_team_balances(_user_id, v_period_end)
   WHERE points_available > 0;

  INSERT INTO public.expansion_period_snapshots
    (user_id, period_start, period_end, personal_points, organizational_points, points_by_team,
     qualified_teams_count, weekly_cap, status_official, active_contract_id, plan_name,
     weekly_cap_value, largest_team_user_id, largest_team_points, other_teams_points,
     vqe_points, payable_vqe_points, bonus_percent, final_bonus, balances_before, run_id, closed_at)
  VALUES (_user_id, _period_start, v_period_end, 0, v_total, v_before,
     v_teams, v_cap, 'closed', v_contract_id, v_plan,
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
    'plan_name', v_plan, 'weekly_cap', v_cap,
    'largest_team_points', v_largest, 'other_teams_points', v_others,
    'vqe_points', v_vqe, 'payable_vqe_points', v_payable,
    'bonus_percent', v_pct, 'final_bonus', v_final,
    'total_points_consumed', v_total_consumed,
    'balances_before', v_before, 'balances_after', v_after);
END; $$;

-- ============================================================
-- 4) ESTIMATIVA DO PERÍODO ABERTO (mesmo núcleo, sem gravar nada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_estimate_current_period(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ps DATE; v_pe DATE; v_core JSONB; v_week NUMERIC := 0;
BEGIN
  IF _user_id IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF _user_id <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN RETURN '{}'::jsonb; END IF;

  SELECT period_start, period_end INTO v_ps, v_pe FROM public.expansion_current_period();
  v_core := public.expansion_compute_week(_user_id, v_pe);

  SELECT COALESCE(SUM(l.points),0) INTO v_week
    FROM public.expansion_team_memberships m
    JOIN public.expansion_points_ledger l ON l.user_id=m.descendant_user_id AND l.status='CONFIRMED'
   WHERE m.ancestor_user_id=_user_id
     AND (l.created_at AT TIME ZONE 'America/Bahia')::date BETWEEN v_ps AND v_pe;

  RETURN v_core || jsonb_build_object(
    'is_estimate', true,
    'period_start', v_ps,
    'period_end', v_pe,
    'next_close_date', v_pe + 1,
    'week_points', v_week,
    'notice', 'Os valores serão confirmados no fechamento semanal.'
  );
END; $$;

REVOKE ALL ON FUNCTION public.expansion_estimate_current_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_estimate_current_period(uuid) TO authenticated;

-- ============================================================
-- 5) OVERVIEW USANDO O MESMO NÚCLEO
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_get_partner_overview(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ps DATE; v_pe DATE; v_core JSONB; v_week NUMERIC := 0;
  v_snap public.expansion_period_snapshots%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF _user_id <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN RETURN '{}'::jsonb; END IF;

  SELECT period_start, period_end INTO v_ps, v_pe FROM public.expansion_current_period();
  v_core := public.expansion_compute_week(_user_id, v_pe);

  SELECT COALESCE(SUM(l.points),0) INTO v_week
    FROM public.expansion_team_memberships m
    JOIN public.expansion_points_ledger l ON l.user_id=m.descendant_user_id AND l.status='CONFIRMED'
   WHERE m.ancestor_user_id=_user_id
     AND (l.created_at AT TIME ZONE 'America/Bahia')::date BETWEEN v_ps AND v_pe;

  SELECT * INTO v_snap FROM public.expansion_period_snapshots
   WHERE user_id=_user_id ORDER BY period_start DESC LIMIT 1;

  RETURN jsonb_build_object(
    'period_start', v_ps, 'period_end', v_pe,
    'next_close_date', v_pe + 1,
    'teams_count', (v_core->>'teams_count')::int,
    'total_points_available', (v_core->>'total_points_available')::numeric,
    'week_points', v_week,
    'largest_team_user_id', v_core->'largest_team_user_id',
    'largest_team_points', (v_core->>'largest_team_points')::numeric,
    'other_teams_points', (v_core->>'other_teams_points')::numeric,
    'vqe_available', (v_core->>'vqe_points')::numeric,
    'vqe_payable', (v_core->>'payable_vqe_points')::numeric,
    'bonus_percent', (v_core->>'bonus_percent')::numeric,
    'weekly_cap', (v_core->>'weekly_cap')::numeric,
    'estimated_bonus', (v_core->>'final_bonus')::numeric,
    'carryforward_points', (v_core->>'carryforward_points')::numeric,
    'plan_name', v_core->>'plan_name',
    'has_active_contract', (v_core->>'active_contract_id') IS NOT NULL,
    'is_estimate', true,
    'estimate_notice', 'Os valores serão confirmados no fechamento semanal.',
    'last_snapshot', CASE WHEN v_snap.id IS NULL THEN NULL ELSE jsonb_build_object(
        'period_start', v_snap.period_start, 'period_end', v_snap.period_end,
        'status_official', v_snap.status_official, 'final_bonus', v_snap.final_bonus,
        'released_at', v_snap.released_at) END,
    'program', jsonb_build_object(
      'points_generation_enabled', COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_points_generation_enabled'),'false')::boolean,
      'weekly_close_enabled', COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_weekly_close_enabled'),'false')::boolean,
      'payout_enabled', COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_bonus_payout_enabled'),'false')::boolean,
      'auto_release_enabled', COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_auto_release_enabled'),'false')::boolean,
      'official_start_at', NULLIF((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_official_start_at'),'')
    )
  );
END; $$;

-- ============================================================
-- 6) LIBERAÇÃO INTERNA (não exposta a usuários)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_release_bonus_internal(_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_snap public.expansion_period_snapshots%ROWTYPE;
  v_payout_reference UUID;
  v_source_ref TEXT;
  v_payout_id UUID;
  v_before NUMERIC; v_after NUMERIC;
  v_payout_enabled BOOLEAN;
BEGIN
  v_payout_enabled := COALESCE((SELECT setting_value FROM public.system_settings
                                 WHERE setting_key='expansion_bonus_payout_enabled')='true', false);
  IF NOT v_payout_enabled THEN
    RETURN jsonb_build_object('status','SKIPPED_DISABLED','snapshot_id',_snapshot_id);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('exp_release:'||_snapshot_id::text,0));

  SELECT * INTO v_snap FROM public.expansion_period_snapshots WHERE id=_snapshot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','NOT_FOUND','snapshot_id',_snapshot_id);
  END IF;
  IF v_snap.status_official = 'released' THEN
    RETURN jsonb_build_object('status','ALREADY_RELEASED','snapshot_id',_snapshot_id);
  END IF;
  IF v_snap.status_official <> 'closed' THEN
    RETURN jsonb_build_object('status','NOT_CLOSED','snapshot_id',_snapshot_id,'current',v_snap.status_official);
  END IF;
  IF v_snap.period_end >= public.expansion_bahia_today() THEN
    RETURN jsonb_build_object('status','PERIOD_NOT_ENDED','snapshot_id',_snapshot_id);
  END IF;
  IF COALESCE((v_snap.computation_meta->>'blocked')::boolean,false) THEN
    RETURN jsonb_build_object('status','BLOCKED','snapshot_id',_snapshot_id);
  END IF;
  IF COALESCE(v_snap.final_bonus,0) <= 0 THEN
    RETURN jsonb_build_object('status','ZERO_BONUS','snapshot_id',_snapshot_id);
  END IF;
  IF v_snap.user_id IS NULL THEN
    RETURN jsonb_build_object('status','NO_USER','snapshot_id',_snapshot_id);
  END IF;

  v_source_ref := 'expansion_bonus:snapshot:' || _snapshot_id::text;

  IF EXISTS (SELECT 1 FROM public.partner_payouts
              WHERE source_type='expansion_snapshot' AND source_ref=v_source_ref) THEN
    RETURN jsonb_build_object('status','ALREADY_RELEASED','snapshot_id',_snapshot_id,'reason','source_ref exists');
  END IF;

  v_payout_reference := COALESCE(v_snap.payout_reference, gen_random_uuid());

  PERFORM pg_advisory_xact_lock(hashtextextended('pnw:' || v_snap.user_id::text, 0));

  INSERT INTO public.partner_network_wallets (user_id)
  VALUES (v_snap.user_id) ON CONFLICT (user_id) DO NOTHING;

  SELECT available_balance INTO v_before
    FROM public.partner_network_wallets WHERE user_id=v_snap.user_id FOR UPDATE;
  v_after := v_before + v_snap.final_bonus;

  INSERT INTO public.partner_payouts
    (partner_contract_id, period_start, period_end, calculated_amount, amount,
     weekly_cap_applied, total_cap_applied, status, paid_at,
     payout_type, source_type, source_id, source_ref,
     gross_amount, adjustment_amount, final_amount)
  VALUES (v_snap.active_contract_id, v_snap.period_start, v_snap.period_end,
          v_snap.final_bonus, v_snap.final_bonus, false, false, 'PENDING', NULL,
          'expansion_bonus', 'expansion_snapshot', _snapshot_id, v_source_ref,
          v_snap.final_bonus, 0, v_snap.final_bonus)
  RETURNING id INTO v_payout_id;

  INSERT INTO public.partner_network_wallet_transactions
    (wallet_user_id, transaction_type, bonus_type, direction, amount,
     source_type, source_id, source_ref, balance_before, balance_after,
     status, notes, metadata, created_by)
  VALUES (v_snap.user_id, 'bonus_credit', 'expansion_bonus', 'credit', v_snap.final_bonus,
          'expansion_snapshot', _snapshot_id, v_source_ref, v_before, v_after,
          'COMPLETED', 'Liberação de Bônus de Expansão — disponível para saque',
          jsonb_build_object('payout_id', v_payout_id,
                             'payout_reference', v_payout_reference,
                             'period_start', v_snap.period_start,
                             'period_end', v_snap.period_end),
          NULL);

  UPDATE public.partner_network_wallets
     SET available_balance = v_after,
         total_credited = total_credited + v_snap.final_bonus,
         updated_at = now()
   WHERE user_id = v_snap.user_id;

  UPDATE public.expansion_period_snapshots
     SET status_official='released', released_at=now(), payout_reference=v_payout_reference
   WHERE id=_snapshot_id;

  INSERT INTO public.expansion_admin_audit
    (admin_id, action, target_type, target_id, before_value, after_value, reason)
  VALUES (auth.uid(),'release_bonus','expansion_snapshot',_snapshot_id::text,
          jsonb_build_object('snapshot_id',_snapshot_id,'amount',v_snap.final_bonus,'user_id',v_snap.user_id),
          jsonb_build_object('payout_reference',v_payout_reference,'payout_id',v_payout_id,
                             'wallet','partner_network_wallets','source_ref',v_source_ref,
                             'payout_status','PENDING','paid_at',NULL),
          'expansion bonus release — crédito disponível na carteira de bônus');

  RETURN jsonb_build_object('status','RELEASED','snapshot_id',_snapshot_id,'user_id',v_snap.user_id,
    'amount',v_snap.final_bonus,'payout_id',v_payout_id,'payout_reference',v_payout_reference,
    'source_ref',v_source_ref,'balance_before',v_before,'balance_after',v_after);
END; $$;

REVOKE ALL ON FUNCTION public.expansion_release_bonus_internal(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_release_bonus_internal(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.expansion_release_bonus_internal(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_release_bonus_internal(uuid) TO postgres;

-- wrapper administrativo (mantém assinatura existente)
CREATE OR REPLACE FUNCTION public.expansion_release_bonus(_snapshot_id uuid, _payout_reference uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_res JSONB;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF _payout_reference IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.expansion_period_snapshots
                WHERE payout_reference=_payout_reference AND id<>_snapshot_id) THEN
      RAISE EXCEPTION 'payout_reference already used';
    END IF;
    UPDATE public.expansion_period_snapshots
       SET payout_reference=_payout_reference
     WHERE id=_snapshot_id AND payout_reference IS NULL;
  END IF;

  v_res := public.expansion_release_bonus_internal(_snapshot_id);

  IF v_res->>'status' NOT IN ('RELEASED','ALREADY_RELEASED') THEN
    RAISE EXCEPTION 'release not possible: %', v_res->>'status';
  END IF;

  RETURN _snapshot_id;
END; $$;

-- ============================================================
-- 7) ORQUESTRAÇÃO (cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_release_closed_period(_period_start date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period DATE := COALESCE(_period_start, public.expansion_last_closed_week());
  v_end DATE := COALESCE(_period_start, public.expansion_last_closed_week()) + 6;
  v_pay BOOLEAN; v_auto BOOLEAN;
  r RECORD; res JSONB;
  v_released INT := 0; v_skipped INT := 0; v_err INT := 0; v_total NUMERIC := 0;
  v_details JSONB := '[]'::jsonb;
BEGIN
  v_pay  := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_bonus_payout_enabled')='true',false);
  v_auto := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_auto_release_enabled')='true',false);
  IF NOT v_pay OR NOT v_auto THEN
    RETURN jsonb_build_object('status','SKIPPED_DISABLED','period_start',v_period,
      'payout_enabled',v_pay,'auto_release_enabled',v_auto);
  END IF;

  IF EXISTS (SELECT 1 FROM public.expansion_close_runs
              WHERE period_start=v_period AND status='RUNNING') THEN
    RETURN jsonb_build_object('status','CLOSE_IN_PROGRESS','period_start',v_period);
  END IF;

  FOR r IN
    SELECT id FROM public.expansion_period_snapshots
     WHERE period_start=v_period AND status_official='closed'
       AND COALESCE(final_bonus,0) > 0
       AND period_end < public.expansion_bahia_today()
     ORDER BY created_at
  LOOP
    BEGIN
      res := public.expansion_release_bonus_internal(r.id);
      IF res->>'status'='RELEASED' THEN
        v_released := v_released + 1;
        v_total := v_total + COALESCE((res->>'amount')::numeric,0);
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
      v_details := v_details || jsonb_build_array(res);
    EXCEPTION WHEN OTHERS THEN
      v_err := v_err + 1;
      v_details := v_details || jsonb_build_array(jsonb_build_object('status','ERROR','snapshot_id',r.id,'error',SQLERRM));
    END;
  END LOOP;

  IF v_released = 0 AND v_skipped = 0 AND v_err = 0 THEN
    RETURN jsonb_build_object('status','NO_ELIGIBLE_SNAPSHOTS','period_start',v_period);
  END IF;

  RETURN jsonb_build_object('status','COMPLETED','period_start',v_period,'period_end',v_end,
    'released',v_released,'skipped',v_skipped,'errors',v_err,'total_amount',v_total,'details',v_details);
END; $$;

REVOKE ALL ON FUNCTION public.expansion_release_closed_period(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_release_closed_period(date) FROM anon;
REVOKE ALL ON FUNCTION public.expansion_release_closed_period(date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_release_closed_period(date) TO postgres;

CREATE OR REPLACE FUNCTION public.expansion_release_recovery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pay BOOLEAN; v_auto BOOLEAN;
  r RECORD; res JSONB;
  v_released INT := 0; v_skipped INT := 0; v_err INT := 0; v_total NUMERIC := 0;
  v_details JSONB := '[]'::jsonb;
BEGIN
  v_pay  := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_bonus_payout_enabled')='true',false);
  v_auto := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_auto_release_enabled')='true',false);
  IF NOT v_pay OR NOT v_auto THEN
    RETURN jsonb_build_object('status','SKIPPED_DISABLED','payout_enabled',v_pay,'auto_release_enabled',v_auto);
  END IF;

  FOR r IN
    SELECT s.id FROM public.expansion_period_snapshots s
     WHERE s.status_official='closed'
       AND COALESCE(s.final_bonus,0) > 0
       AND s.period_end < public.expansion_bahia_today()
       AND NOT EXISTS (SELECT 1 FROM public.expansion_close_runs cr
                        WHERE cr.period_start=s.period_start AND cr.status='RUNNING')
     ORDER BY s.period_start, s.created_at
  LOOP
    BEGIN
      res := public.expansion_release_bonus_internal(r.id);
      IF res->>'status'='RELEASED' THEN
        v_released := v_released + 1;
        v_total := v_total + COALESCE((res->>'amount')::numeric,0);
      ELSE v_skipped := v_skipped + 1; END IF;
      v_details := v_details || jsonb_build_array(res);
    EXCEPTION WHEN OTHERS THEN
      v_err := v_err + 1;
      v_details := v_details || jsonb_build_array(jsonb_build_object('status','ERROR','snapshot_id',r.id,'error',SQLERRM));
    END;
  END LOOP;

  IF v_released = 0 AND v_skipped = 0 AND v_err = 0 THEN
    RETURN jsonb_build_object('status','NO_ELIGIBLE_SNAPSHOTS');
  END IF;

  RETURN jsonb_build_object('status','COMPLETED','released',v_released,'skipped',v_skipped,
    'errors',v_err,'total_amount',v_total,'details',v_details);
END; $$;

REVOKE ALL ON FUNCTION public.expansion_release_recovery() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_release_recovery() FROM anon;
REVOKE ALL ON FUNCTION public.expansion_release_recovery() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_release_recovery() TO postgres;

-- ============================================================
-- 8) BLOQUEIO DE ALTERAÇÕES ESTRUTURAIS (imutabilidade temporal)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expansion_structural_lock_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT setting_value FROM public.system_settings
                    WHERE setting_key='expansion_structural_lock_enabled')='true', false)
$$;

CREATE OR REPLACE FUNCTION public.expansion_block_sponsor_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id
     AND public.expansion_structural_lock_active() THEN
    RAISE EXCEPTION 'Alteração estrutural temporariamente bloqueada para preservar o histórico de pontos do Programa de Expansão.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_expansion_block_sponsor_change ON public.partner_contracts;
CREATE TRIGGER trg_expansion_block_sponsor_change
BEFORE UPDATE ON public.partner_contracts
FOR EACH ROW EXECUTE FUNCTION public.expansion_block_sponsor_change();

CREATE OR REPLACE FUNCTION public.expansion_block_membership_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF public.expansion_structural_lock_active()
     AND EXISTS (SELECT 1 FROM public.expansion_points_ledger l
                  WHERE l.user_id = OLD.descendant_user_id AND l.status='CONFIRMED') THEN
    RAISE EXCEPTION 'Alteração estrutural temporariamente bloqueada para preservar o histórico de pontos do Programa de Expansão.';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_expansion_block_membership_delete ON public.expansion_team_memberships;
CREATE TRIGGER trg_expansion_block_membership_delete
BEFORE DELETE ON public.expansion_team_memberships
FOR EACH ROW EXECUTE FUNCTION public.expansion_block_membership_delete();

CREATE OR REPLACE FUNCTION public.expansion_block_membership_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF public.expansion_structural_lock_active()
     AND (NEW.ancestor_user_id IS DISTINCT FROM OLD.ancestor_user_id
          OR NEW.team_root_user_id IS DISTINCT FROM OLD.team_root_user_id)
     AND EXISTS (SELECT 1 FROM public.expansion_points_ledger l
                  WHERE l.user_id = OLD.descendant_user_id AND l.status='CONFIRMED') THEN
    RAISE EXCEPTION 'Alteração estrutural temporariamente bloqueada para preservar o histórico de pontos do Programa de Expansão.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_expansion_block_membership_update ON public.expansion_team_memberships;
CREATE TRIGGER trg_expansion_block_membership_update
BEFORE UPDATE ON public.expansion_team_memberships
FOR EACH ROW EXECUTE FUNCTION public.expansion_block_membership_update();

-- ============================================================
-- 9) CRONS
-- ============================================================
SELECT cron.schedule('expansion-weekly-release','10 3 * * 1',
  $cron$SELECT public.expansion_release_closed_period(NULL);$cron$);

SELECT cron.schedule('expansion-release-recovery','10 6 * * *',
  $cron$SELECT public.expansion_release_recovery();$cron$);
