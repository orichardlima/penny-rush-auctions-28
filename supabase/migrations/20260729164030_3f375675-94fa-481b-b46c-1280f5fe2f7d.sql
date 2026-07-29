
ALTER TABLE public.partner_contracts
  ADD COLUMN IF NOT EXISTS network_bonus_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS network_bonus_total_received NUMERIC(18,2) NOT NULL DEFAULT 0;

-- Atualiza expansion_release_bonus para creditar na carteira de rede e categorizar o payout
CREATE OR REPLACE FUNCTION public.expansion_release_bonus(
  _snapshot_id UUID,
  _payout_reference UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_status TEXT;
  v_existing UUID;
  v_partner UUID;
  v_amount NUMERIC;
  v_contract UUID;
  v_period_start DATE;
  v_period_end DATE;
  v_payout_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT status_official, user_id, final_bonus, payout_reference,
         active_contract_id, period_start, period_end
    INTO v_status, v_partner, v_amount, v_existing,
         v_contract, v_period_start, v_period_end
    FROM public.expansion_period_snapshots
   WHERE id = _snapshot_id
   FOR UPDATE;

  IF v_status IS NULL THEN RAISE EXCEPTION 'snapshot not found'; END IF;

  IF v_status='released' AND v_existing = _payout_reference THEN
    RETURN _snapshot_id;
  END IF;
  IF v_status='released' THEN
    RAISE EXCEPTION 'snapshot already released';
  END IF;
  IF v_status <> 'closed' THEN
    RAISE EXCEPTION 'snapshot must be closed to release (current: %)', v_status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.expansion_period_snapshots
     WHERE payout_reference = _payout_reference AND id <> _snapshot_id
  ) THEN
    RAISE EXCEPTION 'payout_reference already used';
  END IF;

  IF v_amount > 0 THEN
    IF v_contract IS NULL THEN
      RAISE EXCEPTION 'snapshot has no active_contract_id — cannot credit wallet';
    END IF;

    -- Payout categorizado como bônus de rede (Bônus de Expansão)
    INSERT INTO public.partner_payouts
      (partner_contract_id, period_start, period_end, calculated_amount, amount,
       weekly_cap_applied, total_cap_applied, status, paid_at,
       payout_type, source_type, source_id, source_ref,
       gross_amount, adjustment_amount, final_amount)
    VALUES (v_contract, v_period_start, v_period_end, v_amount, v_amount,
            false, false, 'PAID', now(),
            'expansion_bonus', 'expansion_snapshot', _snapshot_id, _snapshot_id::text,
            v_amount, 0, v_amount)
    RETURNING id INTO v_payout_id;

    -- Crédito EXCLUSIVAMENTE na carteira de rede (nunca no total do contrato)
    UPDATE public.partner_contracts
       SET network_bonus_balance = COALESCE(network_bonus_balance,0) + v_amount,
           network_bonus_total_received = COALESCE(network_bonus_total_received,0) + v_amount
     WHERE id = v_contract;
  END IF;

  UPDATE public.expansion_period_snapshots
     SET status_official='released', released_at=now(), payout_reference=_payout_reference
   WHERE id = _snapshot_id;

  INSERT INTO public.expansion_admin_audit
    (admin_user_id, action, target_user_id, before_state, after_state, reason)
  VALUES (auth.uid(),'release_bonus',v_partner,
          jsonb_build_object('snapshot_id',_snapshot_id,'amount',v_amount),
          jsonb_build_object('payout_reference',_payout_reference,'payout_id',v_payout_id,
                             'wallet','network_bonus_balance'),
          'expansion bonus release — network wallet');

  RETURN _snapshot_id;
END;
$function$;
