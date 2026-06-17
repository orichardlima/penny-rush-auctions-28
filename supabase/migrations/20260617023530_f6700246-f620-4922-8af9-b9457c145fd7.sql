
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ===== contract_versions =====
CREATE TABLE IF NOT EXISTS public.contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_type text NOT NULL CHECK (contract_type IN ('partner','bettor')),
  version text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  content_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (contract_type, version)
);

GRANT SELECT ON public.contract_versions TO anon, authenticated;
GRANT ALL ON public.contract_versions TO service_role;
ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_versions_read_all" ON public.contract_versions FOR SELECT USING (true);
CREATE POLICY "contract_versions_admin_insert" ON public.contract_versions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));
CREATE POLICY "contract_versions_admin_update_active" ON public.contract_versions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));

CREATE OR REPLACE FUNCTION public.contract_versions_protect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_hash := encode(extensions.digest(NEW.content::bytea, 'sha256'), 'hex');
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.contract_type IS DISTINCT FROM OLD.contract_type
       OR NEW.title IS DISTINCT FROM OLD.title THEN
      RAISE EXCEPTION 'Conteúdo de versão de contrato é imutável. Crie uma nova versão.';
    END IF;
    NEW.content_hash := OLD.content_hash;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.contract_acceptances WHERE contract_version_id = OLD.id) THEN
      RAISE EXCEPTION 'Versão de contrato já aceita não pode ser excluída.';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_versions_protect ON public.contract_versions;
CREATE TRIGGER trg_contract_versions_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.contract_versions
  FOR EACH ROW EXECUTE FUNCTION public.contract_versions_protect();

-- ===== contract_acceptances =====
CREATE TABLE IF NOT EXISTS public.contract_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_type text NOT NULL CHECK (contract_type IN ('partner','bettor')),
  contract_version_id uuid NOT NULL REFERENCES public.contract_versions(id) ON DELETE RESTRICT,
  version_label text NOT NULL,
  content_hash text NOT NULL,
  partner_contract_id uuid REFERENCES public.partner_contracts(id) ON DELETE SET NULL,
  origin text NOT NULL CHECK (origin IN ('signup','partner_adhesion','partner_upgrade','renewal','amendment')),
  full_name text, cpf text, email text, phone text,
  plan_name text, plan_value numeric,
  ip_address inet, user_agent text, browser text, os text, device text,
  route text, declaration_text text NOT NULL,
  accepted_at_client timestamptz,
  server_timestamp timestamptz NOT NULL DEFAULT now(),
  payment_reference text, extra jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_acceptances_user ON public.contract_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_acceptances_partner_contract ON public.contract_acceptances(partner_contract_id);

GRANT SELECT, INSERT ON public.contract_acceptances TO authenticated;
GRANT ALL ON public.contract_acceptances TO service_role;
ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acceptances_select_self_or_admin" ON public.contract_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));
CREATE POLICY "acceptances_insert_self" ON public.contract_acceptances
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "acceptances_no_update" ON public.contract_acceptances
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "acceptances_no_delete" ON public.contract_acceptances
  FOR DELETE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.contract_acceptances_block_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Registros de aceite eletrônico são imutáveis.'; END;
$$;
DROP TRIGGER IF EXISTS trg_contract_acceptances_no_update ON public.contract_acceptances;
CREATE TRIGGER trg_contract_acceptances_no_update
  BEFORE UPDATE OR DELETE ON public.contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.contract_acceptances_block_changes();

-- ===== contract_evidence_access_log =====
CREATE TABLE IF NOT EXISTS public.contract_evidence_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id uuid REFERENCES public.contract_acceptances(id) ON DELETE SET NULL,
  partner_contract_id uuid REFERENCES public.partner_contracts(id) ON DELETE SET NULL,
  admin_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('view','export_pdf','export_financial','copy_legal')),
  accessed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet, user_agent text, extra jsonb DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.contract_evidence_access_log TO authenticated;
GRANT ALL ON public.contract_evidence_access_log TO service_role;
ALTER TABLE public.contract_evidence_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_log_admin_read" ON public.contract_evidence_access_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));
CREATE POLICY "evidence_log_admin_insert" ON public.contract_evidence_access_log
  FOR INSERT TO authenticated
  WITH CHECK (admin_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));

-- ===== RPC: register_contract_acceptance =====
CREATE OR REPLACE FUNCTION public.register_contract_acceptance(
  p_contract_type text, p_origin text, p_declaration_text text,
  p_partner_contract_id uuid DEFAULT NULL, p_plan_name text DEFAULT NULL, p_plan_value numeric DEFAULT NULL,
  p_ip text DEFAULT NULL, p_user_agent text DEFAULT NULL,
  p_browser text DEFAULT NULL, p_os text DEFAULT NULL, p_device text DEFAULT NULL,
  p_route text DEFAULT NULL, p_accepted_at_client timestamptz DEFAULT NULL,
  p_payment_reference text DEFAULT NULL, p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_version_id uuid; v_version_label text; v_hash text;
  v_profile record; v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  SELECT id, version, content_hash INTO v_version_id, v_version_label, v_hash
  FROM public.contract_versions
  WHERE contract_type = p_contract_type AND is_active = true
  ORDER BY effective_from DESC LIMIT 1;
  IF v_version_id IS NULL THEN RAISE EXCEPTION 'Sem versão ativa do contrato %.', p_contract_type; END IF;
  SELECT full_name, cpf, email, phone INTO v_profile FROM public.profiles WHERE user_id = v_user;
  INSERT INTO public.contract_acceptances(
    user_id, contract_type, contract_version_id, version_label, content_hash,
    partner_contract_id, origin, full_name, cpf, email, phone,
    plan_name, plan_value, ip_address, user_agent, browser, os, device,
    route, declaration_text, accepted_at_client, payment_reference, extra
  ) VALUES (
    v_user, p_contract_type, v_version_id, v_version_label, v_hash,
    p_partner_contract_id, p_origin, v_profile.full_name, v_profile.cpf, v_profile.email, v_profile.phone,
    p_plan_name, p_plan_value, NULLIF(p_ip,'')::inet, p_user_agent, p_browser, p_os, p_device,
    p_route, p_declaration_text, p_accepted_at_client, p_payment_reference, COALESCE(p_extra,'{}'::jsonb)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.register_contract_acceptance(text,text,text,uuid,text,numeric,text,text,text,text,text,text,timestamptz,text,jsonb) TO authenticated;

-- ===== RPC: log_evidence_access =====
CREATE OR REPLACE FUNCTION public.log_evidence_access(
  p_acceptance_id uuid, p_partner_contract_id uuid, p_action text,
  p_ip text DEFAULT NULL, p_user_agent text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true) THEN
    RAISE EXCEPTION 'Apenas administradores.';
  END IF;
  INSERT INTO public.contract_evidence_access_log(acceptance_id, partner_contract_id, admin_user_id, action, ip_address, user_agent)
  VALUES (p_acceptance_id, p_partner_contract_id, auth.uid(), p_action, NULLIF(p_ip,'')::inet, p_user_agent)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.log_evidence_access(uuid,uuid,text,text,text) TO authenticated;

-- ===== RPC: calculate_early_termination =====
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
  SELECT COALESCE(SUM(amount),0) INTO v_withdrawals FROM public.partner_withdrawals WHERE user_id = c.user_id AND status IN ('PAID','APPROVED','PROCESSING');
  SELECT COALESCE(SUM(amount),0) INTO v_ref_bonus FROM public.partner_referral_bonuses WHERE beneficiary_user_id = c.user_id;
  SELECT COALESCE(SUM(amount),0) INTO v_binary_bonus FROM public.binary_bonuses WHERE user_id = c.user_id;
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
GRANT EXECUTE ON FUNCTION public.calculate_early_termination(uuid) TO authenticated;

-- ===== RPC: generate_partner_evidence_report =====
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'week_start',week_start,'week_end',week_end,'status',status,'paid_at',paid_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_payouts FROM public.partner_payouts WHERE partner_contract_id = p_partner_contract_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'status',status,'created_at',created_at,'paid_at',paid_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_withdrawals FROM public.partner_withdrawals WHERE user_id = c.user_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'status',status,'level',level,'created_at',created_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_ref FROM public.partner_referral_bonuses WHERE beneficiary_user_id = c.user_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'bids_amount',bids_amount,'price',price,'status',status,'created_at',created_at) ORDER BY created_at), '[]'::jsonb)
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
GRANT EXECUTE ON FUNCTION public.generate_partner_evidence_report(uuid) TO authenticated;

-- ===== Seed v1 =====
INSERT INTO public.contract_versions(contract_type, version, title, content, is_active, effective_from)
SELECT 'partner', 'v1', 'Contrato de Adesão ao Programa de Parceiros',
  COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='contract_partner_text'),
           'Contrato de Adesão ao Programa de Parceiros — Show de Lances (v1).'),
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.contract_versions WHERE contract_type='partner');

INSERT INTO public.contract_versions(contract_type, version, title, content, is_active, effective_from)
SELECT 'bettor', 'v1', 'Termos de Uso do Apostador',
  COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='contract_bettor_text'),
           'Termos de Uso do Apostador — Show de Lances (v1).'),
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.contract_versions WHERE contract_type='bettor');
