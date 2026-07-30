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
     weekly_cap_applied, total_cap_applied, status, paid_at, source,
     payout_type, source_type, source_id, source_ref,
     gross_amount, adjustment_amount, final_amount)
  VALUES (v_snap.active_contract_id, v_snap.period_start, v_snap.period_end,
          v_snap.final_bonus, v_snap.final_bonus, false, false, 'PENDING', NULL, 'expansion_bonus',
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
