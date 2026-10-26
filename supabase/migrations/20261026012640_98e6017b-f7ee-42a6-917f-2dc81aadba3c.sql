CREATE OR REPLACE FUNCTION public._is_privileged_writer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT current_user NOT IN ('authenticated','anon') OR coalesce(public.is_admin_user(auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION public.guard_partner_contracts_write()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF public._is_privileged_writer() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Criação de contrato não permitida' USING ERRCODE='42501';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['pix_key','pix_key_type','bank_details','updated_at'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['pix_key','pix_key_type','bank_details','updated_at']) THEN
    RAISE EXCEPTION 'Somente dados de pagamento podem ser alterados' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_partner_contracts_write ON public.partner_contracts;
CREATE TRIGGER trg_guard_partner_contracts_write BEFORE INSERT OR UPDATE ON public.partner_contracts
FOR EACH ROW EXECUTE FUNCTION public.guard_partner_contracts_write();

CREATE OR REPLACE FUNCTION public.guard_partner_withdrawals_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF public._is_privileged_writer() THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Use a solicitação oficial de saque' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS trg_guard_partner_withdrawals_insert ON public.partner_withdrawals;
CREATE TRIGGER trg_guard_partner_withdrawals_insert BEFORE INSERT ON public.partner_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.guard_partner_withdrawals_insert();

CREATE OR REPLACE FUNCTION public.guard_affiliate_withdrawals_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE _bal numeric;
BEGIN
  IF public._is_privileged_writer() THEN RETURN NEW; END IF;
  NEW.status := 'pending'; NEW.processed_at := NULL; NEW.processed_by := NULL; NEW.rejection_reason := NULL;
  SELECT commission_balance INTO _bal FROM public.affiliates WHERE id = NEW.affiliate_id;
  IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount > coalesce(_bal,0) THEN
    RAISE EXCEPTION 'Saldo insuficiente' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_affiliate_withdrawals_insert ON public.affiliate_withdrawals;
CREATE TRIGGER trg_guard_affiliate_withdrawals_insert BEFORE INSERT ON public.affiliate_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.guard_affiliate_withdrawals_insert();

CREATE OR REPLACE FUNCTION public.guard_affiliates_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF public._is_privileged_writer() THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - ARRAY['pix_key','bank_details']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['pix_key','bank_details']) THEN
    RAISE EXCEPTION 'Somente dados de PIX podem ser alterados' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_affiliates_update ON public.affiliates;
CREATE TRIGGER trg_guard_affiliates_update BEFORE UPDATE ON public.affiliates
FOR EACH ROW EXECUTE FUNCTION public.guard_affiliates_update();

CREATE OR REPLACE FUNCTION public.guard_fury_withdrawals_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF public._is_privileged_writer() THEN RETURN NEW; END IF;
  IF lower(coalesce(NEW.status,'pending')) <> 'pending' OR NEW.processed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Saque inválido' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_fury_withdrawals_insert ON public.fury_vault_withdrawals;
CREATE TRIGGER trg_guard_fury_withdrawals_insert BEFORE INSERT ON public.fury_vault_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.guard_fury_withdrawals_insert();