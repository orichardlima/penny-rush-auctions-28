ALTER TABLE public.partner_referral_bonuses
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.partner_referral_bonuses
    WHERE id IN (
      '94bb6834-ad75-47e7-a3a2-81960416ca82',
      '0bdd8287-af2c-4879-8a71-2bbbd0eefd3e',
      'd980f08d-48a4-4673-a7b5-86a69844b141',
      'a58a2afa-9f73-46fb-9f05-2273ea7137d0',
      '549badb0-1776-48c4-82b1-eee1cc634ce7',
      '7883c0d1-545a-4aef-a82e-827d308cff6e'
    )
      AND status = 'PENDING'
      AND is_fast_start_bonus = true
      AND wallet_transaction_id IS NULL
      AND migrated_to_network_wallet = false
  ) <> 6 THEN
    RAISE EXCEPTION 'Cancelamento interrompido: os 6 bônus pendentes originais não foram confirmados';
  END IF;
END;
$$;

INSERT INTO public.admin_audit_log (
  admin_user_id, admin_name, action_type, target_type, target_id,
  old_values, new_values, description
)
SELECT
  'c793d66c-06c5-4fdf-9c2c-0baedd2694f6',
  'Richard Lima',
  'PENDING_FAST_START_DUPLICATES_CANCELLED',
  'partner_contract',
  '92e96025-f003-4b10-ae23-7af5dad598c5',
  jsonb_build_object(
    'bonuses', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'referred_contract_id', b.referred_contract_id,
        'source_event', b.source_event, 'bonus_value', b.bonus_value,
        'status', b.status, 'is_fast_start_bonus', b.is_fast_start_bonus
      ) ORDER BY b.id)
      FROM public.partner_referral_bonuses b
      WHERE b.id IN (
        '94bb6834-ad75-47e7-a3a2-81960416ca82',
        '0bdd8287-af2c-4879-8a71-2bbbd0eefd3e',
        'd980f08d-48a4-4673-a7b5-86a69844b141'
      )
    ),
    'achievement', (
      SELECT jsonb_build_object(
        'id', a.id, 'referrals_count', a.referrals_count,
        'extra_percentage_applied', a.extra_percentage_applied,
        'total_extra_bonus', a.total_extra_bonus, 'processed', a.processed
      )
      FROM public.fast_start_achievements a
      WHERE a.id = '0f58dcda-f1cc-4624-997a-547e37013925'
    )
  ),
  jsonb_build_object(
    'status', 'CANCELLED', 'cancelled_bonuses', 3, 'cancelled_value', 1500.00,
    'achievement_processed', false,
    'reason', 'Meta Acelerador contou upgrade como nova indicação: 3 registros, mas somente 2 pessoas distintas'
  ),
  'Cancelamento autorizado por Richard Lima em 21/11/2026: 3 adicionais pendentes de Início Rápido do DNGG, total R$ 1.500,00. Nenhum bônus creditado ou saldo alterado.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_audit_log
  WHERE action_type = 'PENDING_FAST_START_DUPLICATES_CANCELLED'
    AND target_type = 'partner_contract'
    AND target_id = '92e96025-f003-4b10-ae23-7af5dad598c5'
);

INSERT INTO public.admin_audit_log (
  admin_user_id, admin_name, action_type, target_type, target_id,
  old_values, new_values, description
)
SELECT
  'c793d66c-06c5-4fdf-9c2c-0baedd2694f6',
  'Richard Lima',
  'PENDING_FAST_START_DUPLICATES_CANCELLED',
  'partner_contract',
  'd4565839-59a3-4fb3-b86e-d3f40f905762',
  jsonb_build_object('bonuses', (
    SELECT jsonb_agg(jsonb_build_object(
      'id', b.id, 'referred_contract_id', b.referred_contract_id,
      'source_event', b.source_event, 'bonus_value', b.bonus_value,
      'status', b.status, 'is_fast_start_bonus', b.is_fast_start_bonus
    ) ORDER BY b.id)
    FROM public.partner_referral_bonuses b
    WHERE b.id IN (
      'a58a2afa-9f73-46fb-9f05-2273ea7137d0',
      '549badb0-1776-48c4-82b1-eee1cc634ce7',
      '7883c0d1-545a-4aef-a82e-827d308cff6e'
    )
  )),
  jsonb_build_object(
    'status', 'CANCELLED', 'cancelled_bonuses', 3, 'cancelled_value', 89.94,
    'reason', 'Cancelamento dos adicionais pendentes autorizado junto com a correção das duplicidades exibidas na rede'
  ),
  'Cancelamento autorizado por Richard Lima em 21/11/2026: 3 adicionais pendentes de Início Rápido, total R$ 89,94. Nenhum bônus creditado ou saldo alterado.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_audit_log
  WHERE action_type = 'PENDING_FAST_START_DUPLICATES_CANCELLED'
    AND target_type = 'partner_contract'
    AND target_id = 'd4565839-59a3-4fb3-b86e-d3f40f905762'
);

UPDATE public.partner_referral_bonuses
SET status = 'CANCELLED',
    cancelled_at = now(),
    cancellation_reason = 'PREMATURE_FAST_START_DISTINCT_REFERRALS_2026_11_21'
WHERE id IN (
  '94bb6834-ad75-47e7-a3a2-81960416ca82',
  '0bdd8287-af2c-4879-8a71-2bbbd0eefd3e',
  'd980f08d-48a4-4673-a7b5-86a69844b141'
)
  AND status = 'PENDING'
  AND is_fast_start_bonus = true;

UPDATE public.partner_referral_bonuses
SET status = 'CANCELLED',
    cancelled_at = now(),
    cancellation_reason = 'AUTHORIZED_PENDING_FAST_START_CANCELLATION_2026_11_21'
WHERE id IN (
  'a58a2afa-9f73-46fb-9f05-2273ea7137d0',
  '549badb0-1776-48c4-82b1-eee1cc634ce7',
  '7883c0d1-545a-4aef-a82e-827d308cff6e'
)
  AND status = 'PENDING'
  AND is_fast_start_bonus = true;

UPDATE public.fast_start_achievements
SET processed = false
WHERE id = '0f58dcda-f1cc-4624-997a-547e37013925'
  AND partner_contract_id = '92e96025-f003-4b10-ae23-7af5dad598c5'
  AND referrals_count = 3
  AND extra_percentage_applied = 2
  AND processed = true;

CREATE OR REPLACE FUNCTION public.check_fast_start_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_contract RECORD;
  v_window_end timestamptz;
  v_referrals_count integer;
  v_tier RECORD;
  v_current_max_pct numeric;
BEGIN
  IF NEW.referral_level != 1 OR NEW.is_fast_start_bonus = true THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_contract
  FROM public.partner_contracts
  WHERE id = NEW.referrer_contract_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_window_end := v_contract.created_at + interval '30 days';
  IF now() > v_window_end THEN
    RETURN NEW;
  END IF;

  -- Ativação e upgrade da mesma pessoa contam como uma única indicação.
  SELECT COUNT(DISTINCT referred_user_id) INTO v_referrals_count
  FROM public.partner_referral_bonuses
  WHERE referrer_contract_id = NEW.referrer_contract_id
    AND referral_level = 1
    AND status != 'CANCELLED'
    AND is_fast_start_bonus = false
    AND created_at <= v_window_end;

  SELECT COALESCE(MAX(extra_percentage_applied), 0) INTO v_current_max_pct
  FROM public.fast_start_achievements
  WHERE partner_contract_id = NEW.referrer_contract_id
    AND processed = true;

  FOR v_tier IN
    SELECT * FROM public.fast_start_tiers
    WHERE is_active = true
      AND required_referrals <= v_referrals_count
      AND extra_percentage > v_current_max_pct
    ORDER BY extra_percentage DESC
    LIMIT 1
  LOOP
    PERFORM public.process_fast_start_bonus(NEW.referrer_contract_id, v_tier.id);
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_fast_start_bonus(p_contract_id uuid, p_tier_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tier RECORD;
  v_contract RECORD;
  v_bonus RECORD;
  v_extra_pct numeric;
  v_extra_value numeric;
  v_total_extra numeric := 0;
  v_referrals_count integer;
  v_window_end timestamptz;
  v_prev_extra_pct numeric := 0;
BEGIN
  SELECT * INTO v_tier FROM public.fast_start_tiers WHERE id = p_tier_id AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_contract FROM public.partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_window_end := v_contract.created_at + interval '30 days';

  IF EXISTS (
    SELECT 1 FROM public.fast_start_achievements
    WHERE partner_contract_id = p_contract_id
      AND extra_percentage_applied >= v_tier.extra_percentage
      AND processed = true
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(extra_percentage_applied), 0) INTO v_prev_extra_pct
  FROM public.fast_start_achievements
  WHERE partner_contract_id = p_contract_id AND processed = true;

  IF v_tier.extra_percentage <= v_prev_extra_pct THEN RETURN; END IF;
  v_extra_pct := v_tier.extra_percentage - v_prev_extra_pct;

  -- A meta é por pessoas distintas; upgrade não é uma nova indicação.
  SELECT COUNT(DISTINCT referred_user_id) INTO v_referrals_count
  FROM public.partner_referral_bonuses
  WHERE referrer_contract_id = p_contract_id
    AND referral_level = 1
    AND status != 'CANCELLED'
    AND is_fast_start_bonus = false
    AND created_at <= v_window_end;

  IF v_referrals_count < v_tier.required_referrals THEN
    RETURN;
  END IF;

  FOR v_bonus IN
    SELECT * FROM public.partner_referral_bonuses
    WHERE referrer_contract_id = p_contract_id
      AND referral_level = 1
      AND status != 'CANCELLED'
      AND is_fast_start_bonus = false
      AND created_at <= v_window_end
  LOOP
    v_extra_value := (v_bonus.aporte_value * v_extra_pct) / 100;

    INSERT INTO public.partner_referral_bonuses AS prb (
      referrer_contract_id, referred_contract_id, referred_user_id, aporte_value,
      bonus_percentage, bonus_value, referral_level, status, available_at,
      is_fast_start_bonus, source_event
    ) VALUES (
      p_contract_id, v_bonus.referred_contract_id, v_bonus.referred_user_id, v_bonus.aporte_value,
      v_extra_pct, v_extra_value, 1, 'PENDING', public.add_business_days(now(), 7),
      true, v_bonus.source_event
    )
    ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus, source_event)
    DO UPDATE SET
      bonus_percentage = CASE
        WHEN prb.status = 'CANCELLED' THEN EXCLUDED.bonus_percentage
        ELSE prb.bonus_percentage + EXCLUDED.bonus_percentage
      END,
      bonus_value = CASE
        WHEN prb.status = 'CANCELLED' THEN EXCLUDED.bonus_value
        ELSE prb.bonus_value + EXCLUDED.bonus_value
      END,
      status = CASE
        WHEN prb.status = 'CANCELLED' THEN 'PENDING'
        ELSE prb.status
      END,
      available_at = CASE
        WHEN prb.status = 'CANCELLED' THEN EXCLUDED.available_at
        ELSE prb.available_at
      END,
      cancelled_at = CASE
        WHEN prb.status = 'CANCELLED' THEN NULL
        ELSE prb.cancelled_at
      END,
      cancellation_reason = CASE
        WHEN prb.status = 'CANCELLED' THEN NULL
        ELSE prb.cancellation_reason
      END
    WHERE prb.referrer_contract_id = EXCLUDED.referrer_contract_id
      AND (
        prb.status <> 'CANCELLED'
        OR prb.cancellation_reason = 'PREMATURE_FAST_START_DISTINCT_REFERRALS_2026_11_21'
      );

    IF FOUND THEN
      v_total_extra := v_total_extra + v_extra_value;
    END IF;
  END LOOP;

  INSERT INTO public.fast_start_achievements (
    partner_contract_id, tier_id, referrals_count,
    extra_percentage_applied, total_extra_bonus, processed
  ) VALUES (
    p_contract_id, p_tier_id, v_referrals_count,
    v_tier.extra_percentage, v_total_extra, true
  );
END;
$function$;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.partner_referral_bonuses
    WHERE id IN (
      '94bb6834-ad75-47e7-a3a2-81960416ca82',
      '0bdd8287-af2c-4879-8a71-2bbbd0eefd3e',
      'd980f08d-48a4-4673-a7b5-86a69844b141',
      'a58a2afa-9f73-46fb-9f05-2273ea7137d0',
      '549badb0-1776-48c4-82b1-eee1cc634ce7',
      '7883c0d1-545a-4aef-a82e-827d308cff6e'
    ) AND status = 'CANCELLED'
  ) <> 6 THEN
    RAISE EXCEPTION 'Falha na confirmação do cancelamento dos 6 bônus';
  END IF;
END;
$$;