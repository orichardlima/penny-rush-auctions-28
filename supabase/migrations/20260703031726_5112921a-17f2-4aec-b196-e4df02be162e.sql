
-- =========================================================
-- 1. system_settings: versões atuais dos contratos
-- =========================================================
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES
  ('current_bettor_contract_version', 'v1', 'string', 'Versão atual do contrato do apostador. Bump para forçar reaceite.'),
  ('current_partner_contract_version', 'v1', 'string', 'Versão atual do contrato do parceiro. Bump para forçar reaceite.')
ON CONFLICT (setting_key) DO NOTHING;

-- =========================================================
-- 2. contract_versions: coluna content_html + trigger de hash canônico
-- =========================================================
ALTER TABLE public.contract_versions
  ADD COLUMN IF NOT EXISTS content_html text;

-- Trigger: content_hash é sempre SHA-256 do content (canônico) - server-side
CREATE OR REPLACE FUNCTION public.compute_contract_version_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS NULL OR length(trim(NEW.content)) = 0 THEN
    RAISE EXCEPTION 'contract_versions.content não pode ser vazio';
  END IF;
  NEW.content_hash := encode(extensions.digest(NEW.content, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_contract_version_hash ON public.contract_versions;
CREATE TRIGGER trg_compute_contract_version_hash
  BEFORE INSERT OR UPDATE OF content ON public.contract_versions
  FOR EACH ROW EXECUTE FUNCTION public.compute_contract_version_hash();

-- =========================================================
-- 3. contract_acceptances: imutabilidade + RLS restrita
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_contract_acceptances_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- service_role pode fazer qualquer coisa (bypass do trigger)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'contract_acceptances é imutável: UPDATE não permitido';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'contract_acceptances é imutável: DELETE não permitido';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_acceptances_immutable ON public.contract_acceptances;
CREATE TRIGGER trg_contract_acceptances_immutable
  BEFORE UPDATE OR DELETE ON public.contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_acceptances_immutability();

-- Reforçar RLS: negar INSERT/UPDATE/DELETE diretos a authenticated (apenas via RPC SECURITY DEFINER)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='contract_acceptances'
      AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.contract_acceptances', r.policyname);
  END LOOP;
END $$;

-- Manter apenas SELECT próprio (recriar se não existir)
DROP POLICY IF EXISTS "Users can view their own contract acceptances" ON public.contract_acceptances;
CREATE POLICY "Users can view their own contract acceptances"
  ON public.contract_acceptances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Revogar INSERT/UPDATE/DELETE de authenticated (SELECT permanece)
REVOKE INSERT, UPDATE, DELETE ON public.contract_acceptances FROM authenticated;
GRANT SELECT ON public.contract_acceptances TO authenticated;
GRANT ALL ON public.contract_acceptances TO service_role;

-- =========================================================
-- 4. RPC: check_contract_version_status
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_contract_version_status(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_bettor_current text;
  v_partner_current text;
  v_bettor_accepted text;
  v_partner_accepted text;
  v_has_partner_contract boolean := false;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'bettor', jsonb_build_object('current', null, 'accepted', null, 'needs_reaccept', false),
      'partner', jsonb_build_object('current', null, 'accepted', null, 'needs_reaccept', false)
    );
  END IF;

  SELECT setting_value INTO v_bettor_current FROM public.system_settings WHERE setting_key='current_bettor_contract_version';
  SELECT setting_value INTO v_partner_current FROM public.system_settings WHERE setting_key='current_partner_contract_version';

  SELECT version_label INTO v_bettor_accepted
  FROM public.contract_acceptances
  WHERE user_id = v_user_id AND contract_type = 'bettor'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT EXISTS(
    SELECT 1 FROM public.partner_contracts
    WHERE user_id = v_user_id AND status IN ('ACTIVE','PENDING')
  ) INTO v_has_partner_contract;

  IF v_has_partner_contract THEN
    SELECT version_label INTO v_partner_accepted
    FROM public.contract_acceptances
    WHERE user_id = v_user_id AND contract_type = 'partner'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  v_result := jsonb_build_object(
    'bettor', jsonb_build_object(
      'current', v_bettor_current,
      'accepted', v_bettor_accepted,
      'needs_reaccept', (v_bettor_current IS NOT NULL AND v_bettor_accepted IS DISTINCT FROM v_bettor_current)
    ),
    'partner', jsonb_build_object(
      'current', v_partner_current,
      'accepted', v_partner_accepted,
      'needs_reaccept', (v_has_partner_contract AND v_partner_current IS NOT NULL AND v_partner_accepted IS DISTINCT FROM v_partner_current)
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_contract_version_status(uuid) TO authenticated;

-- =========================================================
-- 5. settlement_quotes: cotações temporárias de encerramento
-- =========================================================
CREATE TABLE IF NOT EXISTS public.settlement_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  partner_contract_id uuid NOT NULL,
  termination_id uuid,
  liquidation_type text NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  discounts numeric NOT NULL DEFAULT 0,
  penalty numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  terms_text text NOT NULL,
  terms_hash text NOT NULL,
  terms_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_settlement_quotes_user ON public.settlement_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_quotes_contract ON public.settlement_quotes(partner_contract_id);
CREATE INDEX IF NOT EXISTS idx_settlement_quotes_expires ON public.settlement_quotes(expires_at);

GRANT SELECT ON public.settlement_quotes TO authenticated;
GRANT ALL ON public.settlement_quotes TO service_role;

ALTER TABLE public.settlement_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settlement quotes"
  ON public.settlement_quotes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 6. settlement_acceptances: aceites finais imutáveis
-- =========================================================
CREATE TABLE IF NOT EXISTS public.settlement_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  partner_contract_id uuid NOT NULL,
  termination_id uuid,
  quote_id uuid REFERENCES public.settlement_quotes(id),
  liquidation_type text NOT NULL,
  gross_amount numeric NOT NULL,
  discounts numeric NOT NULL,
  penalty numeric NOT NULL,
  net_amount numeric NOT NULL,
  terms_version text NOT NULL,
  terms_hash text NOT NULL,
  terms_text text NOT NULL,
  declaration_text text NOT NULL,
  ip_address inet,
  user_agent text,
  browser text,
  os text,
  device text,
  route text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  receipt_html text,
  processing_status text NOT NULL DEFAULT 'SIGNED'
    CHECK (processing_status IN ('SIGNED','TERMINATION_PROCESSED','TERMINATION_FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_settlement_acceptances_user ON public.settlement_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_acceptances_contract ON public.settlement_acceptances(partner_contract_id);
CREATE INDEX IF NOT EXISTS idx_settlement_acceptances_accepted_at ON public.settlement_acceptances(accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_acceptances_quote ON public.settlement_acceptances(quote_id);

GRANT SELECT ON public.settlement_acceptances TO authenticated;
GRANT ALL ON public.settlement_acceptances TO service_role;

ALTER TABLE public.settlement_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settlement acceptances"
  ON public.settlement_acceptances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger: imutabilidade exceto processing_status (que só service_role pode alterar)
CREATE OR REPLACE FUNCTION public.enforce_settlement_acceptances_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'settlement_acceptances é imutável: DELETE não permitido';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Permitir apenas mudança em processing_status
    IF (row_to_json(NEW.*)::jsonb - 'processing_status') <> (row_to_json(OLD.*)::jsonb - 'processing_status') THEN
      RAISE EXCEPTION 'settlement_acceptances é imutável: apenas processing_status pode ser alterado (via service_role)';
    END IF;
    -- Ainda assim, authenticated não pode alterar
    RAISE EXCEPTION 'settlement_acceptances.processing_status só pode ser alterado via service_role';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_settlement_acceptances_immutable ON public.settlement_acceptances;
CREATE TRIGGER trg_settlement_acceptances_immutable
  BEFORE UPDATE OR DELETE ON public.settlement_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.enforce_settlement_acceptances_immutability();

-- =========================================================
-- 7. RPC: finalize_partner_settlement_acceptance (transacional, anti-doubleclick)
-- =========================================================
CREATE OR REPLACE FUNCTION public.finalize_partner_settlement_acceptance(
  p_quote_id uuid,
  p_ip text,
  p_user_agent text,
  p_browser text,
  p_os text,
  p_device text,
  p_route text,
  p_declaration_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_quote public.settlement_quotes%ROWTYPE;
  v_recalc_hash text;
  v_acceptance_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- 1. Consumo atômico do quote com FOR UPDATE + double-check
  UPDATE public.settlement_quotes
     SET consumed_at = now()
   WHERE id = p_quote_id
     AND user_id = v_uid
     AND consumed_at IS NULL
     AND expires_at > now()
  RETURNING * INTO v_quote;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'Cotação de encerramento inválida, expirada ou já consumida';
  END IF;

  -- 2. Revalidar hash server-side
  v_recalc_hash := encode(extensions.digest(v_quote.terms_text, 'sha256'), 'hex');
  IF v_recalc_hash <> v_quote.terms_hash THEN
    RAISE EXCEPTION 'Divergência de hash do termo: cotação corrompida';
  END IF;

  -- 3. Inserir aceite imutável
  INSERT INTO public.settlement_acceptances (
    user_id, partner_contract_id, termination_id, quote_id,
    liquidation_type, gross_amount, discounts, penalty, net_amount,
    terms_version, terms_hash, terms_text, declaration_text,
    ip_address, user_agent, browser, os, device, route,
    accepted_at, processing_status
  ) VALUES (
    v_uid, v_quote.partner_contract_id, v_quote.termination_id, v_quote.id,
    v_quote.liquidation_type, v_quote.gross_amount, v_quote.discounts, v_quote.penalty, v_quote.net_amount,
    v_quote.terms_version, v_quote.terms_hash, v_quote.terms_text, p_declaration_text,
    NULLIF(p_ip,'')::inet, p_user_agent, p_browser, p_os, p_device, p_route,
    now(), 'SIGNED'
  ) RETURNING id INTO v_acceptance_id;

  RETURN jsonb_build_object(
    'acceptance_id', v_acceptance_id,
    'quote_id', v_quote.id,
    'terms_hash', v_quote.terms_hash,
    'accepted_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_partner_settlement_acceptance(uuid,text,text,text,text,text,text,text) TO authenticated;

-- =========================================================
-- 8. Seed inicial de contract_versions v1 se ainda não existir
-- =========================================================
INSERT INTO public.contract_versions (contract_type, version, title, content, is_active, effective_from)
SELECT 'bettor', 'v1', 'Contrato do Apostador', 
  'Contrato do Apostador da Show de Lances - Versão v1. Ao aceitar este termo, o usuário declara ciência das regras de leilões, custo de lances, entrega de produtos e demais condições da plataforma.',
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.contract_versions WHERE contract_type='bettor' AND version='v1');

INSERT INTO public.contract_versions (contract_type, version, title, content, is_active, effective_from)
SELECT 'partner', 'v1', 'Contrato de Adesão ao Programa de Parceiros',
  'Contrato de Adesão ao Programa de Parceiros da Show de Lances - Versão v1. Este é um programa de parceria de expansão. Os repasses dependem do faturamento real da plataforma. Não constitui investimento financeiro. Aplicam-se regras de indicação, bônus, limites de recebimento e demais condições contratuais.',
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.contract_versions WHERE contract_type='partner' AND version='v1');
