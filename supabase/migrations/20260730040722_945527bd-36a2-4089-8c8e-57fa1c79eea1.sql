
-- 1) Controle de migração
ALTER TABLE public.partner_referral_bonuses
  ADD COLUMN IF NOT EXISTS migrated_at timestamptz,
  ADD COLUMN IF NOT EXISTS wallet_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS migrated_to_network_wallet boolean NOT NULL DEFAULT false;

-- 2) Rotina única, atômica e idempotente de crédito na carteira de rede
CREATE OR REPLACE FUNCTION public.credit_referral_bonus_to_network_wallet(_bonus_id uuid, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_b RECORD;
  v_user uuid;
  v_ref text;
  v_before numeric;
  v_after numeric;
  v_tx uuid;
  v_payout uuid;
  v_type text;
BEGIN
  SELECT b.*, pc.user_id AS referrer_user_id
    INTO v_b
    FROM public.partner_referral_bonuses b
    LEFT JOIN public.partner_contracts pc ON pc.id = b.referrer_contract_id
   WHERE b.id = _bonus_id
   FOR UPDATE OF b;

  IF v_b.id IS NULL THEN
    RAISE EXCEPTION 'bonus not found: %', _bonus_id;
  END IF;

  v_user := v_b.referrer_user_id;
  v_ref  := 'referral_bonus:' || _bonus_id::text;

  IF v_b.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'CANCELLED');
  END IF;

  -- idempotência oficial: source_ref
  IF EXISTS (SELECT 1 FROM public.partner_network_wallet_transactions WHERE source_ref = v_ref) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'ALREADY_CREDITED', 'source_ref', v_ref);
  END IF;

  IF v_user IS NULL OR COALESCE(v_b.bonus_value,0) <= 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'NO_USER_OR_ZERO_VALUE');
  END IF;

  v_type := CASE WHEN v_b.is_fast_start_bonus THEN 'fast_start_bonus'
                 WHEN COALESCE(v_b.referral_level,1) = 1 THEN 'direct_referral_bonus'
                 ELSE 'indirect_referral_bonus' END;

  PERFORM pg_advisory_xact_lock(hashtextextended('pnw:' || v_user::text, 0));

  INSERT INTO public.partner_network_wallets (user_id) VALUES (v_user)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT available_balance INTO v_before
    FROM public.partner_network_wallets WHERE user_id = v_user FOR UPDATE;
  v_after := v_before + v_b.bonus_value;

  INSERT INTO public.partner_payouts (
    partner_contract_id, period_start, period_end,
    calculated_amount, amount, weekly_cap_applied, total_cap_applied,
    status, source, referral_bonus_id,
    payout_type, source_type, source_id, source_ref,
    gross_amount, adjustment_amount, final_amount
  ) VALUES (
    v_b.referrer_contract_id,
    COALESCE(v_b.available_at, v_b.created_at)::date,
    COALESCE(v_b.available_at, v_b.created_at)::date,
    v_b.bonus_value, v_b.bonus_value, false, false,
    'PENDING', 'referral_bonus', v_b.id,
    v_type, 'partner_referral_bonus', v_b.id, v_ref,
    v_b.bonus_value, 0, v_b.bonus_value
  )
  ON CONFLICT (referral_bonus_id) DO UPDATE
    SET payout_type = EXCLUDED.payout_type,
        source_type = EXCLUDED.source_type,
        source_id   = EXCLUDED.source_id,
        source_ref  = EXCLUDED.source_ref,
        gross_amount = EXCLUDED.gross_amount,
        adjustment_amount = 0,
        final_amount = EXCLUDED.final_amount
  RETURNING id INTO v_payout;

  INSERT INTO public.partner_network_wallet_transactions (
    wallet_user_id, transaction_type, bonus_type, direction, amount,
    source_type, source_id, source_ref, balance_before, balance_after,
    status, notes, metadata, created_by
  ) VALUES (
    v_user, 'bonus_credit', v_type, 'credit', v_b.bonus_value,
    'partner_referral_bonus', v_b.id, v_ref, v_before, v_after,
    'COMPLETED', COALESCE(_note, 'Crédito de bônus de indicação na carteira de rede'),
    jsonb_build_object('payout_id', v_payout, 'referral_level', v_b.referral_level,
                       'previous_status', v_b.status),
    auth.uid()
  ) RETURNING id INTO v_tx;

  UPDATE public.partner_network_wallets
     SET available_balance = v_after,
         total_credited = total_credited + v_b.bonus_value,
         updated_at = now()
   WHERE user_id = v_user;

  UPDATE public.partner_referral_bonuses
     SET status = 'CREDITED',
         migrated_at = now(),
         migrated_to_network_wallet = true,
         wallet_transaction_id = v_tx
   WHERE id = _bonus_id;

  RETURN jsonb_build_object(
    'credited', true, 'bonus_id', _bonus_id, 'user_id', v_user,
    'amount', v_b.bonus_value, 'balance_before', v_before, 'balance_after', v_after,
    'transaction_id', v_tx, 'payout_id', v_payout, 'source_ref', v_ref,
    'bonus_type', v_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_referral_bonus_to_network_wallet(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_referral_bonus_to_network_wallet(uuid, text) TO service_role;

-- 3) Migração dos bônus AVAILABLE (transação única, rollback integral em caso de erro)
DO $mig$
DECLARE
  r RECORD;
  res jsonb;
  v_count int := 0;
  v_total numeric := 0;
  v_before_sum numeric;
  v_after_sum numeric;
  v_expected numeric;
BEGIN
  SELECT COALESCE(SUM(available_balance),0) INTO v_before_sum FROM public.partner_network_wallets;
  SELECT COALESCE(SUM(bonus_value),0) INTO v_expected
    FROM public.partner_referral_bonuses WHERE status = 'AVAILABLE';

  FOR r IN SELECT id FROM public.partner_referral_bonuses WHERE status = 'AVAILABLE' ORDER BY created_at
  LOOP
    res := public.credit_referral_bonus_to_network_wallet(r.id, 'Migração histórica de bônus de indicação para a carteira de rede');
    IF COALESCE((res->>'credited')::boolean, false) THEN
      v_count := v_count + 1;
      v_total := v_total + (res->>'amount')::numeric;
    END IF;
    RAISE NOTICE 'bonus % -> %', r.id, res;
  END LOOP;

  SELECT COALESCE(SUM(available_balance),0) INTO v_after_sum FROM public.partner_network_wallets;

  IF v_after_sum - v_before_sum <> v_total THEN
    RAISE EXCEPTION 'Conciliação falhou: delta carteira % <> total migrado %', v_after_sum - v_before_sum, v_total;
  END IF;
  IF v_total <> v_expected THEN
    RAISE EXCEPTION 'Conciliação falhou: migrado % <> esperado %', v_total, v_expected;
  END IF;

  RAISE NOTICE 'Migração concluída: % bônus, R$ %', v_count, v_total;
END;
$mig$;

-- 4) Cron de carência passa a creditar diretamente na carteira de rede
CREATE OR REPLACE FUNCTION public.release_pending_referral_bonuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus RECORD;
  released_count integer := 0;
  res jsonb;
BEGIN
  FOR v_bonus IN
    SELECT id
      FROM public.partner_referral_bonuses
     WHERE status = 'PENDING'
       AND available_at IS NOT NULL
       AND available_at <= now()
     ORDER BY available_at
  LOOP
    res := public.credit_referral_bonus_to_network_wallet(
             v_bonus.id, 'Liberação automática pós-carência — carteira de rede');
    IF COALESCE((res->>'credited')::boolean, false) THEN
      released_count := released_count + 1;
    END IF;
  END LOOP;

  RETURN released_count;
END;
$$;
