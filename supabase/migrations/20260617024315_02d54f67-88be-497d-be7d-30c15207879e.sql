
CREATE OR REPLACE FUNCTION public.calculate_early_termination(p_partner_contract_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record; v_req timestamptz; v_days int; v_within7 boolean;
  v_payouts numeric := 0; v_withdrawals numeric := 0;
  v_ref_bonus numeric := 0; v_binary_bonus numeric := 0;
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
  SELECT COALESCE(SUM(amount),0) INTO v_payouts FROM public.partner_payouts WHERE partner_contract_id = p_partner_contract_id;
  SELECT COALESCE(SUM(amount),0) INTO v_withdrawals FROM public.partner_withdrawals
    WHERE partner_contract_id = p_partner_contract_id AND status IN ('PAID','APPROVED','PROCESSING');
  SELECT COALESCE(SUM(bonus_value),0) INTO v_ref_bonus FROM public.partner_referral_bonuses
    WHERE referrer_contract_id = p_partner_contract_id;
  SELECT COALESCE(SUM(bonus_value),0) INTO v_binary_bonus FROM public.binary_bonuses
    WHERE partner_contract_id = p_partner_contract_id;
  v_bids_received := COALESCE(c.bonus_bids_received, 0);
  SELECT COUNT(*) INTO v_bids_used FROM public.bids WHERE user_id = c.user_id;
  IF v_within7 AND v_payouts=0 AND v_withdrawals=0 AND v_ref_bonus=0 AND v_binary_bonus=0 AND v_bids_used=0 THEN
    v_full_refund := true; v_balance := c.aporte_value; v_deadline_days := 10;
  ELSE
    v_penalty := c.aporte_value * 0.30;
    v_discounts := v_payouts + v_withdrawals + v_ref_bonus + v_binary_bonus + (v_bids_used * v_bid_avg_value);
    v_balance := GREATEST(0, c.aporte_value - v_penalty - v_discounts);
    v_deadline_days := 30;
  END IF;
  RETURN jsonb_build_object(
    'partner_contract_id', p_partner_contract_id,
    'aporte', c.aporte_value, 'data_adesao', c.created_at, 'data_solicitacao', v_req,
    'dias_decorridos', v_days, 'dentro_garantia_7d', v_within7,
    'total_repasses', v_payouts, 'total_saques', v_withdrawals,
    'bonus_indicacao', v_ref_bonus, 'bonus_binario', v_binary_bonus,
    'lances_recebidos', v_bids_received, 'lances_utilizados', v_bids_used,
    'valor_estimado_lance', v_bid_avg_value,
    'devolucao_integral', v_full_refund, 'multa_30_pct', v_penalty,
    'descontos', v_discounts, 'saldo_final_a_devolver', v_balance,
    'prazo_pagamento_dias', v_deadline_days
  );
END; $$;

CREATE OR REPLACE FUNCTION public.generate_partner_evidence_report(p_partner_contract_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record; prof record; acc record; v_calc jsonb;
  v_payouts jsonb; v_withdrawals jsonb; v_ref jsonb; v_purchases jsonb; v_bids jsonb;
  v_intent record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true) THEN
    RAISE EXCEPTION 'Apenas administradores.';
  END IF;
  SELECT * INTO c FROM public.partner_contracts WHERE id = p_partner_contract_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado.'; END IF;
  SELECT * INTO prof FROM public.profiles WHERE user_id = c.user_id;
  SELECT a.*, v.title AS contract_title, v.content AS contract_content INTO acc
    FROM public.contract_acceptances a
    LEFT JOIN public.contract_versions v ON v.id = a.contract_version_id
    WHERE a.partner_contract_id = p_partner_contract_id
       OR (a.user_id = c.user_id AND a.contract_type='partner' AND a.origin='partner_adhesion')
    ORDER BY a.server_timestamp ASC LIMIT 1;
  SELECT * INTO v_intent FROM public.partner_payment_intents WHERE user_id = c.user_id ORDER BY created_at DESC LIMIT 1;
  v_calc := public.calculate_early_termination(p_partner_contract_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'period_start',period_start,'period_end',period_end,'status',status,'paid_at',paid_at,'created_at',created_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_payouts FROM public.partner_payouts WHERE partner_contract_id = p_partner_contract_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'status',status,'requested_at',requested_at,'paid_at',paid_at,'created_at',created_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_withdrawals FROM public.partner_withdrawals WHERE partner_contract_id = p_partner_contract_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'bonus_value',bonus_value,'status',status,'level',referral_level,'created_at',created_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_ref FROM public.partner_referral_bonuses WHERE referrer_contract_id = p_partner_contract_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'bids_purchased',bids_purchased,'amount_paid',amount_paid,'payment_status',payment_status,'created_at',created_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_purchases FROM public.bid_purchases WHERE user_id = c.user_id;
  SELECT jsonb_build_object('total_lances', COUNT(*)) INTO v_bids FROM public.bids WHERE user_id = c.user_id;

  RETURN jsonb_build_object(
    'gerado_em', now(), 'gerado_por', auth.uid(),
    'parceiro', jsonb_build_object(
      'user_id', c.user_id, 'nome', prof.full_name, 'cpf', prof.cpf,
      'email', prof.email, 'telefone', prof.phone, 'data_cadastro', prof.created_at,
      'endereco', jsonb_build_object('cep',prof.cep,'rua',prof.street,'numero',prof.number,'complemento',prof.complement,'bairro',prof.neighborhood,'cidade',prof.city,'estado',prof.state)
    ),
    'contrato', jsonb_build_object(
      'id', c.id, 'plano', c.plan_name, 'aporte', c.aporte_value,
      'teto_semanal', c.weekly_cap, 'teto_total', c.total_cap, 'cotas', c.cotas,
      'data_adesao', c.created_at, 'status', c.status,
      'payment_status', c.payment_status, 'payment_id', c.payment_id,
      'total_recebido', c.total_received, 'closed_at', c.closed_at, 'closed_reason', c.closed_reason
    ),
    'aceite_eletronico', CASE WHEN acc.id IS NULL THEN
      jsonb_build_object('registrado', false,
        'aviso', 'Aceite eletrônico digital não registrado (contrato anterior ao módulo de evidências). Evidências indiretas: cadastro confirmado, pagamento PIX confirmado, dados cadastrais autodeclarados.')
    ELSE
      jsonb_build_object('registrado', true, 'id', acc.id, 'versao', acc.version_label,
        'hash', acc.content_hash, 'titulo', acc.contract_title, 'origem', acc.origin,
        'declaracao', acc.declaration_text, 'server_timestamp', acc.server_timestamp,
        'accepted_at_client', acc.accepted_at_client, 'ip', acc.ip_address,
        'user_agent', acc.user_agent, 'browser', acc.browser, 'os', acc.os, 'device', acc.device,
        'route', acc.route, 'plan_name', acc.plan_name, 'plan_value', acc.plan_value,
        'conteudo_contrato', acc.contract_content)
    END,
    'pagamento_intent', to_jsonb(v_intent),
    'financeiro', jsonb_build_object('repasses', v_payouts, 'saques', v_withdrawals,
      'bonus_indicacao', v_ref, 'compras_lances', v_purchases, 'lances_utilizados', v_bids),
    'cancelamento_calculo', v_calc
  );
END; $$;
