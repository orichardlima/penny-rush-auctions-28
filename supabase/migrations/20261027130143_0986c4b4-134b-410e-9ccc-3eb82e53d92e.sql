-- 1. Pedidos de pagamento de plano
DROP POLICY IF EXISTS "Users can insert own intents" ON public.partner_payment_intents;

CREATE OR REPLACE FUNCTION public.guard_partner_payment_intents_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public._is_privileged_writer() THEN
    RAISE EXCEPTION 'Operação não permitida: pedidos de pagamento só podem ser gravados pelo servidor' USING ERRCODE='insufficient_privilege';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_guard_ppi_write ON public.partner_payment_intents;
CREATE TRIGGER trg_guard_ppi_write BEFORE INSERT OR UPDATE OR DELETE ON public.partner_payment_intents
FOR EACH ROW EXECUTE FUNCTION public.guard_partner_payment_intents_write();

-- 2. Contratos
DROP POLICY IF EXISTS "Users can create their own contracts" ON public.partner_contracts;
DROP POLICY IF EXISTS "Users can update their own contracts" ON public.partner_contracts;

CREATE OR REPLACE FUNCTION public.protect_partner_contract_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE allow_totals text;
BEGIN
  IF public._is_privileged_writer() OR current_setting('app.partner_payment_details_rpc', true) = 'on' THEN
    IF current_setting('app.partner_payment_details_rpc', true) = 'on' AND NOT public._is_privileged_writer() THEN
      NULL; -- validado abaixo
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  allow_totals := current_setting('app.allow_total_sync', true);
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.total_cap IS DISTINCT FROM OLD.total_cap
     OR NEW.weekly_cap IS DISTINCT FROM OLD.weekly_cap OR NEW.aporte_value IS DISTINCT FROM OLD.aporte_value
     OR NEW.available_balance IS DISTINCT FROM OLD.available_balance
     OR NEW.total_referral_points IS DISTINCT FROM OLD.total_referral_points
     OR NEW.plan_name IS DISTINCT FROM OLD.plan_name OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.bonus_bids_received IS DISTINCT FROM OLD.bonus_bids_received
     OR NEW.network_bonus_balance IS DISTINCT FROM OLD.network_bonus_balance
     OR NEW.network_bonus_total_received IS DISTINCT FROM OLD.network_bonus_total_received
     OR NEW.reserved_balance IS DISTINCT FROM OLD.reserved_balance
     OR NEW.financial_status IS DISTINCT FROM OLD.financial_status
     OR NEW.cotas IS DISTINCT FROM OLD.cotas OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id
     OR NEW.is_demo IS DISTINCT FROM OLD.is_demo
     OR (allow_totals IS DISTINCT FROM 'on' AND (NEW.total_received IS DISTINCT FROM OLD.total_received OR NEW.total_withdrawn IS DISTINCT FROM OLD.total_withdrawn))
  THEN
    RAISE EXCEPTION 'Operação não permitida: campos financeiros do contrato são protegidos' USING ERRCODE='insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS public.partner_payment_details_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  user_id uuid NOT NULL,
  old_pix_key text, old_pix_key_type text, old_bank_details jsonb,
  new_pix_key text, new_pix_key_type text, new_bank_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_payment_details_audit TO authenticated;
GRANT ALL ON public.partner_payment_details_audit TO service_role;
ALTER TABLE public.partner_payment_details_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view payment details audit" ON public.partner_payment_details_audit
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.partner_update_payment_details(
  p_contract_id uuid, p_pix_key text, p_pix_key_type text, p_bank_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); c record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='insufficient_privilege'; END IF;
  SELECT * INTO c FROM partner_contracts WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND OR c.user_id <> v_uid THEN RAISE EXCEPTION 'Contrato não encontrado' USING ERRCODE='insufficient_privilege'; END IF;
  IF p_pix_key IS NULL OR length(trim(p_pix_key)) < 3 OR length(p_pix_key) > 140 THEN RAISE EXCEPTION 'Chave PIX inválida'; END IF;
  IF p_pix_key_type IS NULL OR upper(p_pix_key_type) NOT IN ('CPF','CNPJ','EMAIL','PHONE','EVP','RANDOM','ALEATORIA','TELEFONE') THEN RAISE EXCEPTION 'Tipo de chave PIX inválido'; END IF;
  IF p_bank_details IS NOT NULL AND (jsonb_typeof(p_bank_details) <> 'object' OR length(p_bank_details::text) > 2000) THEN RAISE EXCEPTION 'Dados bancários inválidos'; END IF;
  PERFORM set_config('app.partner_payment_details_rpc', 'on', true);
  UPDATE partner_contracts SET pix_key = trim(p_pix_key), pix_key_type = p_pix_key_type, bank_details = p_bank_details, updated_at = now()
   WHERE id = p_contract_id;
  PERFORM set_config('app.partner_payment_details_rpc', 'off', true);
  INSERT INTO partner_payment_details_audit(contract_id,user_id,old_pix_key,old_pix_key_type,old_bank_details,new_pix_key,new_pix_key_type,new_bank_details)
  VALUES (c.id, v_uid, c.pix_key, c.pix_key_type, c.bank_details, trim(p_pix_key), p_pix_key_type, p_bank_details);
END $$;
REVOKE ALL ON FUNCTION public.partner_update_payment_details(uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_update_payment_details(uuid,text,text,jsonb) TO authenticated;

-- 3. Pedidos de leilão: vencedor não altera direto
DROP POLICY IF EXISTS "Users can update their own orders payment info" ON public.orders;

-- 4. Crédito de lances só pelo servidor
REVOKE EXECUTE ON FUNCTION public.credit_purchase_bids(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;

-- 5. Registro central de confirmações
CREATE TABLE IF NOT EXISTS public.payment_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_transaction_id text NOT NULL,
  external_reference text NOT NULL,
  entity_type text NOT NULL,
  amount numeric,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_transaction_id),
  UNIQUE (provider, external_reference)
);
GRANT ALL ON public.payment_confirmations TO service_role;
GRANT SELECT ON public.payment_confirmations TO authenticated;
ALTER TABLE public.payment_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view payment confirmations" ON public.payment_confirmations
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));