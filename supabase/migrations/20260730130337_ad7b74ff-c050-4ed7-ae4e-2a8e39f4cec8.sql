-- 1) DEMO NÃO GERA PONTOS (bloqueio na origem)
CREATE OR REPLACE FUNCTION public.expansion_credit_contract_activation(_contract_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_gen_enabled BOOLEAN; v_cutoff TIMESTAMPTZ; v_plan_points JSONB;
  v_user UUID; v_plan TEXT; v_created TIMESTAMPTZ; v_is_demo BOOLEAN; v_points INT;
BEGIN
  SELECT (setting_value::boolean) INTO v_gen_enabled FROM public.system_settings WHERE setting_key='expansion_points_generation_enabled';
  IF NOT COALESCE(v_gen_enabled,false) THEN RETURN 0; END IF;

  v_cutoff := public.expansion_effective_cutoff();
  IF v_cutoff IS NULL THEN RETURN 0; END IF;

  SELECT setting_value::jsonb INTO v_plan_points FROM public.system_settings WHERE setting_key='expansion_plan_points';

  SELECT user_id, plan_name, created_at, COALESCE(is_demo,false)
    INTO v_user, v_plan, v_created, v_is_demo
  FROM public.partner_contracts WHERE id = _contract_id AND status='ACTIVE';
  IF v_user IS NULL THEN RETURN 0; END IF;

  -- Contrato demonstrativo: apenas posiciona na rede, nunca gera pontos/volume.
  IF v_is_demo THEN RETURN 0; END IF;

  IF v_created < v_cutoff THEN RETURN 0; END IF;

  v_points := COALESCE((v_plan_points ->> v_plan)::int, 0);
  IF v_points <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.expansion_points_ledger
    (user_id, contract_id, plan_name, points, source, source_ref, status, metadata)
  VALUES
    (v_user, _contract_id, v_plan, v_points, 'contract_activation', _contract_id::text || ':activation', 'CONFIRMED',
     jsonb_build_object('plan', v_plan))
  ON CONFLICT (source_ref) DO NOTHING;

  RETURN v_points;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expansion_credit_upgrade(_upgrade_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_gen_enabled BOOLEAN; v_cutoff TIMESTAMPTZ;
  v_prev TEXT; v_new TEXT; v_user UUID; v_contract UUID; v_created TIMESTAMPTZ;
  v_is_demo BOOLEAN; v_delta INT; v_ref TEXT; v_id UUID;
BEGIN
  SELECT (setting_value::boolean) INTO v_gen_enabled
  FROM public.system_settings WHERE setting_key = 'expansion_points_generation_enabled';
  IF NOT COALESCE(v_gen_enabled, false) THEN RETURN 0; END IF;

  v_cutoff := public.expansion_effective_cutoff();
  IF v_cutoff IS NULL THEN RETURN 0; END IF;

  SELECT u.previous_plan_name, u.new_plan_name, u.created_at, u.partner_contract_id, c.user_id, COALESCE(c.is_demo,false)
    INTO v_prev, v_new, v_created, v_contract, v_user, v_is_demo
  FROM public.partner_upgrades u
  JOIN public.partner_contracts c ON c.id = u.partner_contract_id
  WHERE u.id = _upgrade_id;

  IF v_user IS NULL THEN RETURN 0; END IF;
  IF v_is_demo THEN RETURN 0; END IF;   -- upgrade/cotas demo: zero pontos
  IF v_created < v_cutoff THEN RETURN 0; END IF;

  v_delta := public.expansion_upgrade_points_delta(_upgrade_id);
  IF v_delta <= 0 THEN RETURN 0; END IF;

  v_ref := _upgrade_id::text || ':upgrade';

  INSERT INTO public.expansion_points_ledger
    (user_id, contract_id, plan_name, points, source, source_ref, status, metadata)
  VALUES
    (v_user, v_contract, v_new, v_delta, 'contract_upgrade', v_ref, 'CONFIRMED',
     jsonb_build_object('from', v_prev, 'to', v_new, 'rule', 'plan_points_delta'))
  ON CONFLICT (source_ref) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 0; END IF;
  RETURN v_delta;
END;
$function$;

-- 2) PARCEIRO POSICIONADO COMO DEMO PODE RECEBER BÔNUS SOBRE VOLUME REAL
--    (contrato real tem prioridade; se só existir contrato demo, usa-se o teto do plano dele)
CREATE OR REPLACE FUNCTION public.expansion_close_partner_week(_user_id uuid, _period_start date, _run_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_period_end DATE := _period_start + 6;
  v_snapshot public.expansion_period_snapshots%ROWTYPE;
  v_pct NUMERIC; v_caps JSONB; v_contract RECORD;
  v_cap NUMERIC := 0; v_largest NUMERIC := 0; v_largest_team UUID;
  v_total NUMERIC := 0; v_others NUMERIC := 0; v_vqe NUMERIC := 0;
  v_bonus_raw NUMERIC := 0; v_final NUMERIC := 0; v_payable NUMERIC := 0;
  v_snap_id UUID; v_before JSONB := '{}'::jsonb; v_after JSONB := '{}'::jsonb;
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

  v_pct := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_bonus_percent')::numeric,20);
  v_caps := COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='expansion_weekly_caps')::jsonb,'{}'::jsonb);

  SELECT id, plan_name INTO v_contract
    FROM public.partner_contracts
   WHERE user_id=_user_id AND status='ACTIVE'
   ORDER BY COALESCE(is_demo,false) ASC, aporte_value DESC NULLS LAST, created_at ASC LIMIT 1;

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
$function$;

-- 3) TESTES TRANSACIONAIS (subtransação desfeita; falha aborta a migration)
DO $$
DECLARE v_real UUID; v_n INT; v_ret INT;
BEGIN
  SELECT contract_id INTO v_real FROM public.expansion_points_ledger
   WHERE source='contract_activation' ORDER BY created_at LIMIT 1;
  IF v_real IS NULL THEN RETURN; END IF;

  BEGIN
    UPDATE public.system_settings SET setting_value='2020-01-01T00:00:00+00' WHERE setting_key='expansion_official_start_at';
    DELETE FROM public.expansion_points_ledger WHERE contract_id = v_real;

    -- T1: ativação demo -> zero pontos
    UPDATE public.partner_contracts SET is_demo = true WHERE id = v_real;
    v_ret := public.expansion_credit_contract_activation(v_real);
    SELECT count(*) INTO v_n FROM public.expansion_points_ledger WHERE contract_id = v_real;
    IF v_ret <> 0 OR v_n <> 0 THEN RAISE EXCEPTION 'ROLLBACK_TEST:FAIL demo gerou movimento (ret=% rows=%)', v_ret, v_n; END IF;

    -- T2: upgrade demo -> zero pontos
    SELECT COALESCE(SUM(public.expansion_credit_upgrade(u.id)),0) INTO v_ret
      FROM public.partner_upgrades u WHERE u.partner_contract_id = v_real;
    IF COALESCE(v_ret,0) <> 0 THEN RAISE EXCEPTION 'ROLLBACK_TEST:FAIL upgrade demo pontuou (%)', v_ret; END IF;

    -- T3: contrato real -> pontua normalmente
    UPDATE public.partner_contracts SET is_demo = false WHERE id = v_real;
    v_ret := public.expansion_credit_contract_activation(v_real);
    SELECT count(*) INTO v_n FROM public.expansion_points_ledger WHERE contract_id = v_real;
    IF v_ret <= 0 OR v_n <> 1 THEN RAISE EXCEPTION 'ROLLBACK_TEST:FAIL real nao pontuou (ret=% rows=%)', v_ret, v_n; END IF;

    -- T4: idempotência
    PERFORM public.expansion_credit_contract_activation(v_real);
    SELECT count(*) INTO v_n FROM public.expansion_points_ledger WHERE contract_id = v_real;
    IF v_n <> 1 THEN RAISE EXCEPTION 'ROLLBACK_TEST:FAIL duplicidade (rows=%)', v_n; END IF;

    RAISE EXCEPTION 'ROLLBACK_TEST:OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ROLLBACK_TEST:FAIL%' THEN RAISE EXCEPTION '%', SQLERRM; END IF;
    IF SQLERRM NOT LIKE 'ROLLBACK_TEST:%' THEN RAISE; END IF;
  END;
END $$;

-- 4) ATIVAÇÃO OFICIAL
UPDATE public.system_settings
   SET setting_value = '2026-07-30T12:52:00+00', updated_at = now()
 WHERE setting_key = 'expansion_official_start_at';

UPDATE public.system_settings
   SET setting_value = 'true', updated_at = now()
 WHERE setting_key = 'expansion_weekly_close_enabled';

UPDATE public.system_settings
   SET setting_value = 'false', updated_at = now()
 WHERE setting_key = 'expansion_bonus_payout_enabled';