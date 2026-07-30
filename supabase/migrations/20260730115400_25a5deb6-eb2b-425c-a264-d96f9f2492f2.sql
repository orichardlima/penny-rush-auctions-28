
CREATE OR REPLACE FUNCTION public.expansion_test_harness()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_out JSONB := '[]'::jsonb;
  v_meta JSONB := '{}'::jsonb;
  v_ids UUID[];
  v_period DATE := (date_trunc('week', (now() AT TIME ZONE 'America/Bahia')::date)::date - 7);
  v_cur INT := 11;
  v_res JSONB;
  v_plans TEXT[] := ARRAY['START','PRO','ELITE','Master','Legend','Diamond'];
  v_pl TEXT;
  i INT;
  v_before JSONB;
  v_after JSONB;

  PROCEDURE_DUMMY INT;
BEGIN
  SELECT COALESCE(jsonb_build_object(
    'wallet_tx', (SELECT count(*) FROM public.partner_network_wallet_transactions),
    'payouts', (SELECT count(*) FROM public.partner_payouts),
    'snapshots', (SELECT count(*) FROM public.expansion_period_snapshots),
    'consumptions', (SELECT count(*) FROM public.expansion_team_consumptions),
    'wallet_balance_sum', (SELECT COALESCE(sum(available_balance),0) FROM public.partner_network_wallets)
  ),'{}'::jsonb) INTO v_before;

  BEGIN
    SELECT array_agg(u.id) INTO v_ids FROM (
      SELECT au.id FROM auth.users au
      WHERE NOT EXISTS (SELECT 1 FROM public.partner_contracts pc WHERE pc.user_id = au.id)
        AND NOT EXISTS (SELECT 1 FROM public.expansion_points_ledger l WHERE l.user_id = au.id)
        AND NOT EXISTS (SELECT 1 FROM public.expansion_team_memberships m WHERE m.ancestor_user_id = au.id OR m.descendant_user_id = au.id)
      ORDER BY au.created_at DESC LIMIT 80
    ) u;

    IF v_ids IS NULL OR array_length(v_ids,1) < 40 THEN
      RAISE EXCEPTION 'not enough free auth users for the test (got %)', COALESCE(array_length(v_ids,1),0);
    END IF;

    -- seed test partners (10) with active contracts
    FOR i IN 1..10 LOOP
      INSERT INTO public.partner_contracts (user_id, plan_name, aporte_value, weekly_cap, total_cap, status, cotas)
      VALUES (v_ids[i], CASE WHEN i BETWEEN 4 AND 9 THEN v_plans[i-3] ELSE 'Diamond' END,
              1000, 100000, 200000, 'ACTIVE', 1);
    END LOOP;

    -- clear anything triggers may have generated for our synthetic ids
    DELETE FROM public.expansion_points_ledger WHERE user_id = ANY(v_ids);
    DELETE FROM public.expansion_team_memberships WHERE ancestor_user_id = ANY(v_ids) OR descendant_user_id = ANY(v_ids);

    -- helper seeding inline
    -- scenario 1: one team 1000
    PERFORM public.__exp_seed_team(v_ids[1], v_ids[v_cur], 1000, v_period); v_cur := v_cur + 1;
    -- scenario 2: two balanced teams
    PERFORM public.__exp_seed_team(v_ids[2], v_ids[v_cur], 1000, v_period); v_cur := v_cur + 1;
    PERFORM public.__exp_seed_team(v_ids[2], v_ids[v_cur], 1000, v_period); v_cur := v_cur + 1;
    -- scenario 3: four teams 4000/3000/2000/1000
    PERFORM public.__exp_seed_team(v_ids[3], v_ids[v_cur], 4000, v_period); v_cur := v_cur + 1;
    PERFORM public.__exp_seed_team(v_ids[3], v_ids[v_cur], 3000, v_period); v_cur := v_cur + 1;
    PERFORM public.__exp_seed_team(v_ids[3], v_ids[v_cur], 2000, v_period); v_cur := v_cur + 1;
    PERFORM public.__exp_seed_team(v_ids[3], v_ids[v_cur], 1000, v_period); v_cur := v_cur + 1;
    -- scenario 4: cap per plan (partners 4..9), two huge balanced teams
    FOR i IN 4..9 LOOP
      PERFORM public.__exp_seed_team(v_ids[i], v_ids[v_cur], 100000, v_period); v_cur := v_cur + 1;
      PERFORM public.__exp_seed_team(v_ids[i], v_ids[v_cur], 100000, v_period); v_cur := v_cur + 1;
    END LOOP;
    -- scenario 5: tie between two largest
    PERFORM public.__exp_seed_team(v_ids[10], v_ids[v_cur], 1000, v_period); v_cur := v_cur + 1;
    PERFORM public.__exp_seed_team(v_ids[10], v_ids[v_cur], 1000, v_period); v_cur := v_cur + 1;
    PERFORM public.__exp_seed_team(v_ids[10], v_ids[v_cur], 500, v_period); v_cur := v_cur + 1;

    -- run closes
    FOR i IN 1..10 LOOP
      v_res := public.expansion_close_partner_week(v_ids[i], v_period, NULL);
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'case', CASE WHEN i=1 THEN 'S1 uma equipe'
                     WHEN i=2 THEN 'S2 duas equilibradas'
                     WHEN i=3 THEN 'S3 quatro equipes'
                     WHEN i=10 THEN 'S5 empate'
                     ELSE 'S4 teto plano '||v_plans[i-3] END,
        'plan', v_res->>'plan_name',
        'weekly_cap', v_res->'weekly_cap',
        'largest', v_res->'largest_team_points',
        'others', v_res->'other_teams_points',
        'vqe', v_res->'vqe_points',
        'payable_vqe', v_res->'payable_vqe_points',
        'final_bonus', v_res->'final_bonus',
        'consumed', v_res->'total_points_consumed',
        'status', v_res->>'status',
        'consumption', (SELECT jsonb_agg(jsonb_build_object('role',c.role,'avail',c.points_available,'consumed',c.points_consumed,'after',c.balance_after) ORDER BY c.role, c.points_available DESC)
                          FROM public.expansion_team_consumptions c WHERE c.snapshot_id = (v_res->>'snapshot_id')::uuid),
        'carryforward', (SELECT carryforward_points FROM public.expansion_period_snapshots s WHERE s.id=(v_res->>'snapshot_id')::uuid),
        'snapshot_status', (SELECT status_official FROM public.expansion_period_snapshots s WHERE s.id=(v_res->>'snapshot_id')::uuid)
      ));
    END LOOP;

    -- scenario 6: idempotency on partner 3
    v_res := public.expansion_close_partner_week(v_ids[3], v_period, NULL);
    v_meta := v_meta || jsonb_build_object('idempotency', jsonb_build_object(
      'status', v_res->>'status',
      'snapshots_for_partner', (SELECT count(*) FROM public.expansion_period_snapshots WHERE user_id=v_ids[3] AND period_start=v_period),
      'consumption_rows', (SELECT count(*) FROM public.expansion_team_consumptions WHERE user_id=v_ids[3] AND period_start=v_period),
      'balances_now', (SELECT jsonb_agg(jsonb_build_object('team',team_root_user_id,'available',points_available)) FROM public.expansion_team_balances(v_ids[3], v_period+6))
    ));

    -- scenario 7: batch run
    v_meta := v_meta || jsonb_build_object('batch', public.expansion_run_weekly_close(v_period, 'ADMIN', NULL, 'teste tecnico com rollback'));

    SELECT jsonb_build_object(
      'wallet_tx', (SELECT count(*) FROM public.partner_network_wallet_transactions),
      'payouts', (SELECT count(*) FROM public.partner_payouts),
      'snapshots', (SELECT count(*) FROM public.expansion_period_snapshots),
      'consumptions', (SELECT count(*) FROM public.expansion_team_consumptions),
      'wallet_balance_sum', (SELECT COALESCE(sum(available_balance),0) FROM public.partner_network_wallets),
      'released_snapshots', (SELECT count(*) FROM public.expansion_period_snapshots WHERE status_official='released')
    ) INTO v_after;

    v_meta := v_meta || jsonb_build_object('period_start', v_period, 'period_end', v_period+6,
      'before', v_before, 'after_inside_tx', v_after);

    RAISE EXCEPTION 'ROLLBACK_TEST_HARNESS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_TEST_HARNESS' THEN
      v_meta := v_meta || jsonb_build_object('error', SQLERRM);
    END IF;
  END;

  SELECT jsonb_build_object(
    'wallet_tx', (SELECT count(*) FROM public.partner_network_wallet_transactions),
    'payouts', (SELECT count(*) FROM public.partner_payouts),
    'snapshots', (SELECT count(*) FROM public.expansion_period_snapshots),
    'consumptions', (SELECT count(*) FROM public.expansion_team_consumptions),
    'wallet_balance_sum', (SELECT COALESCE(sum(available_balance),0) FROM public.partner_network_wallets),
    'test_contracts_left', (SELECT count(*) FROM public.partner_contracts WHERE weekly_cap=100000 AND total_cap=200000 AND aporte_value=1000)
  ) INTO v_after;

  RETURN jsonb_build_object('rolled_back_state', v_after, 'meta', v_meta, 'cases', v_out);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.__exp_seed_team(_partner UUID, _member UUID, _points INT, _period DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.expansion_team_memberships (ancestor_user_id, descendant_user_id, team_root_user_id, depth)
  VALUES (_partner, _member, _member, 1)
  ON CONFLICT (ancestor_user_id, descendant_user_id) DO UPDATE SET team_root_user_id = EXCLUDED.team_root_user_id;

  INSERT INTO public.expansion_points_ledger (user_id, points, source, source_ref, status, created_at)
  VALUES (_member, _points, 'TEST_HARNESS', 'test:'||gen_random_uuid()::text, 'CONFIRMED', (_period::timestamp + interval '10 hours') AT TIME ZONE 'America/Bahia');
END;
$$;

REVOKE ALL ON FUNCTION public.expansion_test_harness() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.__exp_seed_team(UUID,UUID,INT,DATE) FROM PUBLIC;
