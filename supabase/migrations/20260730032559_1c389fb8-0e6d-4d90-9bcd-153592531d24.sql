COMMENT ON COLUMN public.partner_contracts.network_bonus_balance IS
  'DEPRECATED — bônus de rede pertencem ao parceiro, não ao contrato. Do not use.';
COMMENT ON COLUMN public.partner_contracts.network_bonus_total_received IS
  'DEPRECATED — bônus de rede pertencem ao parceiro, não ao contrato. Do not use.';

CREATE OR REPLACE FUNCTION public.recalc_partner_contract_totals(_contract_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.allow_total_sync', 'on', true);

  UPDATE public.partner_contracts pc
  SET
    total_received = COALESCE((
      SELECT SUM(amount) FROM public.partner_payouts
      WHERE partner_contract_id = _contract_id
        AND status = 'PAID'
        AND payout_type = 'partnership_weekly_repass'
    ), 0),
    total_withdrawn = COALESCE((
      SELECT SUM(amount) FROM public.partner_withdrawals
      WHERE partner_contract_id = _contract_id AND status = 'PAID'
    ), 0),
    updated_at = now()
  WHERE pc.id = _contract_id;

  PERFORM set_config('app.allow_total_sync', 'off', true);
END;
$function$;

CREATE TABLE IF NOT EXISTS public.partner_network_wallets (
  user_id UUID PRIMARY KEY,
  available_balance NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  total_credited NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_credited >= 0),
  total_withdrawn NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_withdrawn >= 0),
  total_adjusted NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_network_wallets TO authenticated;
GRANT ALL ON public.partner_network_wallets TO service_role;
ALTER TABLE public.partner_network_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partner can view own network wallet" ON public.partner_network_wallets;
CREATE POLICY "Partner can view own network wallet"
  ON public.partner_network_wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.partner_network_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_user_id UUID NOT NULL REFERENCES public.partner_network_wallets(user_id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'bonus_credit','withdrawal_debit','reversal_debit',
    'administrative_credit','administrative_debit','financial_adjustment')),
  bonus_type TEXT CHECK (bonus_type IS NULL OR bonus_type IN (
    'direct_referral_bonus','indirect_referral_bonus','fast_start_bonus',
    'expansion_bonus','leadership_bonus')),
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  source_type TEXT NOT NULL,
  source_id UUID,
  source_ref TEXT NOT NULL,
  balance_before NUMERIC(18,2) NOT NULL,
  balance_after NUMERIC(18,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  notes TEXT,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pnwt_source
  ON public.partner_network_wallet_transactions (source_type, source_ref);
CREATE INDEX IF NOT EXISTS ix_pnwt_wallet
  ON public.partner_network_wallet_transactions (wallet_user_id, created_at DESC);

GRANT SELECT ON public.partner_network_wallet_transactions TO authenticated;
GRANT ALL ON public.partner_network_wallet_transactions TO service_role;
ALTER TABLE public.partner_network_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partner can view own network wallet transactions" ON public.partner_network_wallet_transactions;
CREATE POLICY "Partner can view own network wallet transactions"
  ON public.partner_network_wallet_transactions FOR SELECT TO authenticated
  USING (wallet_user_id = auth.uid() OR public.is_admin_user(auth.uid()));

DROP TRIGGER IF EXISTS trg_pnw_updated_at ON public.partner_network_wallets;
CREATE TRIGGER trg_pnw_updated_at
  BEFORE UPDATE ON public.partner_network_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.expansion_release_bonus(_snapshot_id uuid, _payout_reference uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_source_ref TEXT;
  v_before NUMERIC;
  v_after NUMERIC;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
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

  IF v_status = 'released' THEN
    RETURN _snapshot_id;
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

  v_source_ref := 'expansion_bonus:snapshot:' || _snapshot_id::text;

  IF v_amount > 0 THEN
    IF v_partner IS NULL THEN
      RAISE EXCEPTION 'snapshot has no user_id — cannot credit wallet';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('pnw:' || v_partner::text, 0));

    INSERT INTO public.partner_network_wallets (user_id)
    VALUES (v_partner)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT available_balance INTO v_before
      FROM public.partner_network_wallets
     WHERE user_id = v_partner FOR UPDATE;
    v_after := v_before + v_amount;

    INSERT INTO public.partner_payouts
      (partner_contract_id, period_start, period_end, calculated_amount, amount,
       weekly_cap_applied, total_cap_applied, status, paid_at,
       payout_type, source_type, source_id, source_ref,
       gross_amount, adjustment_amount, final_amount)
    VALUES (v_contract, v_period_start, v_period_end, v_amount, v_amount,
            false, false, 'PAID', now(),
            'expansion_bonus', 'expansion_snapshot', _snapshot_id, v_source_ref,
            v_amount, 0, v_amount)
    RETURNING id INTO v_payout_id;

    INSERT INTO public.partner_network_wallet_transactions
      (wallet_user_id, transaction_type, bonus_type, direction, amount,
       source_type, source_id, source_ref, balance_before, balance_after,
       status, notes, metadata, created_by)
    VALUES (v_partner, 'bonus_credit', 'expansion_bonus', 'credit', v_amount,
            'expansion_snapshot', _snapshot_id, v_source_ref, v_before, v_after,
            'COMPLETED', 'Liberação de Bônus de Expansão',
            jsonb_build_object('payout_id', v_payout_id,
                               'payout_reference', _payout_reference,
                               'period_start', v_period_start,
                               'period_end', v_period_end),
            auth.uid());

    UPDATE public.partner_network_wallets
       SET available_balance = v_after,
           total_credited = total_credited + v_amount,
           updated_at = now()
     WHERE user_id = v_partner;
  END IF;

  UPDATE public.expansion_period_snapshots
     SET status_official='released', released_at=now(), payout_reference=_payout_reference
   WHERE id = _snapshot_id;

  INSERT INTO public.expansion_admin_audit
    (admin_id, action, target_type, target_id, before_value, after_value, reason)
  VALUES (auth.uid(),'release_bonus','expansion_snapshot',_snapshot_id::text,
          jsonb_build_object('snapshot_id',_snapshot_id,'amount',v_amount,'user_id',v_partner),
          jsonb_build_object('payout_reference',_payout_reference,'payout_id',v_payout_id,
                             'wallet','partner_network_wallets','source_ref',v_source_ref),
          'expansion bonus release — partner network wallet');

  RETURN _snapshot_id;
END;
$function$;

INSERT INTO public.expansion_admin_audit
  (admin_id, action, target_type, target_id, before_value, after_value, reason)
VALUES (NULL,'structural_change','schema','partner_network_wallets',
  jsonb_build_object('network_bonus_columns','partner_contracts (in use)'),
  jsonb_build_object(
    'tables_created', jsonb_build_array('partner_network_wallets','partner_network_wallet_transactions'),
    'functions_updated', jsonb_build_array('recalc_partner_contract_totals','expansion_release_bonus'),
    'deprecated_columns', jsonb_build_array('partner_contracts.network_bonus_balance','partner_contracts.network_bonus_total_received')),
  'Criação da carteira oficial de bônus de rede e separação definitiva entre repasses e bônus');