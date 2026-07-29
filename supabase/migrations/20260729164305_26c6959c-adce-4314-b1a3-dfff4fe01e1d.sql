
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
    network_bonus_total_received = COALESCE((
      SELECT SUM(amount) FROM public.partner_payouts
      WHERE partner_contract_id = _contract_id
        AND status = 'PAID'
        AND payout_type <> 'partnership_weekly_repass'
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

CREATE OR REPLACE FUNCTION public.calculate_early_termination(p_partner_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c record; v_req timestamptz; v_days int; v_within7 boolean;
  v_payouts numeric := 0; v_withdrawals numeric := 0;
  v_ref_bonus numeric := 0; v_binary_bonus numeric := 0; v_expansion_bonus numeric := 0;
  v_bids_received int := 0; v_bids_used int := 0;
  v_bid_avg_value numeric := 1.00;
  v_penalty numeric := 0; v_discounts numeric := 0; v_balance numeric := 0;
  v_full_refund boolean := false; v_deadline_days int := 30;
BEGIN
  SELECT * INTO c FROM public.partner_contracts WHERE id = p_partner_contract_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado.'; END IF;

  SELECT requested_at INTO v_req FROM public.partner_early_terminations
    WHERE partner_contract_id = p_partner_contract_id ORDER BY requested_at DESC LIMIT 1;
  v_req := COALESCE(v_req, now());
  v_days := GREATEST(0, EXTRACT(DAY FROM (v_req - c.created_at))::int);
  v_within7 := v_days <= 7;

  -- SOMENTE repasses semanais entram no consumo do aporte
  SELECT COALESCE(SUM(amount),0) INTO v_payouts
    FROM public.partner_payouts
   WHERE partner_contract_id = p_partner_contract_id
     AND payout_type = 'partnership_weekly_repass';

  SELECT COALESCE(SUM(amount),0) INTO v_withdrawals FROM public.partner_withdrawals
    WHERE partner_contract_id = p_partner_contract_id AND status IN ('PAID','APPROVED','PROCESSING');

  -- Bônus de rede: apenas informativos, NÃO descontam do saldo a devolver
  SELECT COALESCE(SUM(bonus_value),0) INTO v_ref_bonus FROM public.partner_referral_bonuses
    WHERE referrer_contract_id = p_partner_contract_id;
  SELECT COALESCE(SUM(bonus_value),0) INTO v_binary_bonus FROM public.binary_bonuses
    WHERE partner_contract_id = p_partner_contract_id;
  SELECT COALESCE(SUM(amount),0) INTO v_expansion_bonus FROM public.partner_payouts
    WHERE partner_contract_id = p_partner_contract_id AND payout_type = 'expansion_bonus';

  v_bids_received := COALESCE(c.bonus_bids_received, 0);
  SELECT COUNT(*) INTO v_bids_used FROM public.bids WHERE user_id = c.user_id;

  IF v_within7 AND v_payouts=0 AND v_withdrawals=0 AND v_ref_bonus=0 AND v_binary_bonus=0
     AND v_expansion_bonus=0 AND v_bids_used=0 THEN
    v_full_refund := true; v_balance := c.aporte_value; v_deadline_days := 10;
  ELSE
    v_penalty := c.aporte_value * 0.30;
    -- Descontos consideram apenas o que efetivamente reduziu o aporte:
    -- repasses semanais, saques e uso de lances. Bônus de rede NÃO descontam.
    v_discounts := v_payouts + v_withdrawals + (v_bids_used * v_bid_avg_value);
    v_balance := GREATEST(0, c.aporte_value - v_penalty - v_discounts);
    v_deadline_days := 30;
  END IF;

  RETURN jsonb_build_object(
    'partner_contract_id', p_partner_contract_id,
    'aporte', c.aporte_value, 'data_adesao', c.created_at, 'data_solicitacao', v_req,
    'dias_decorridos', v_days, 'dentro_garantia_7d', v_within7,
    'total_repasses', v_payouts, 'total_saques', v_withdrawals,
    'bonus_indicacao', v_ref_bonus, 'bonus_binario', v_binary_bonus,
    'bonus_expansao', v_expansion_bonus,
    'lances_recebidos', v_bids_received, 'lances_utilizados', v_bids_used,
    'valor_estimado_lance', v_bid_avg_value,
    'devolucao_integral', v_full_refund, 'multa_30_pct', v_penalty,
    'descontos', v_discounts, 'saldo_final_a_devolver', v_balance,
    'prazo_pagamento_dias', v_deadline_days,
    'observacao', 'Bônus de rede (indicação, binário, expansão) são informativos e não abatem o aporte.'
  );
END; $function$;
