
ALTER TABLE public.settlement_acceptances
  ADD COLUMN IF NOT EXISTS processing_error text;

CREATE OR REPLACE FUNCTION public.enforce_settlement_acceptances_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'settlement_acceptances é imutável: DELETE não permitido.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Campos essenciais nunca podem ser alterados
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.partner_contract_id IS DISTINCT FROM OLD.partner_contract_id
       OR NEW.liquidation_type IS DISTINCT FROM OLD.liquidation_type
       OR NEW.gross_amount IS DISTINCT FROM OLD.gross_amount
       OR NEW.discounts IS DISTINCT FROM OLD.discounts
       OR NEW.penalty IS DISTINCT FROM OLD.penalty
       OR NEW.net_amount IS DISTINCT FROM OLD.net_amount
       OR NEW.terms_version IS DISTINCT FROM OLD.terms_version
       OR NEW.terms_hash IS DISTINCT FROM OLD.terms_hash
       OR NEW.terms_text IS DISTINCT FROM OLD.terms_text
       OR NEW.declaration_text IS DISTINCT FROM OLD.declaration_text
       OR NEW.ip_address IS DISTINCT FROM OLD.ip_address
       OR NEW.user_agent IS DISTINCT FROM OLD.user_agent
       OR NEW.browser IS DISTINCT FROM OLD.browser
       OR NEW.os IS DISTINCT FROM OLD.os
       OR NEW.device IS DISTINCT FROM OLD.device
       OR NEW.route IS DISTINCT FROM OLD.route
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
       OR NEW.quote_id IS DISTINCT FROM OLD.quote_id
    THEN
      RAISE EXCEPTION 'settlement_acceptances: campo essencial não pode ser alterado.';
    END IF;

    -- termination_id: preencher uma vez apenas
    IF NEW.termination_id IS DISTINCT FROM OLD.termination_id
       AND OLD.termination_id IS NOT NULL THEN
      RAISE EXCEPTION 'settlement_acceptances.termination_id já definido, imutável.';
    END IF;

    -- receipt_html: só pode ser preenchido quando ainda nulo
    IF NEW.receipt_html IS DISTINCT FROM OLD.receipt_html
       AND OLD.receipt_html IS NOT NULL THEN
      RAISE EXCEPTION 'settlement_acceptances.receipt_html já emitido, imutável.';
    END IF;

    -- processing_status: apenas transições operacionais válidas
    IF NEW.processing_status IS DISTINCT FROM OLD.processing_status THEN
      IF NOT (
        (OLD.processing_status = 'SIGNED' AND NEW.processing_status IN ('TERMINATION_PROCESSED','TERMINATION_FAILED'))
        OR (OLD.processing_status = 'TERMINATION_FAILED' AND NEW.processing_status = 'TERMINATION_PROCESSED')
      ) THEN
        RAISE EXCEPTION 'settlement_acceptances: transição de processing_status % -> % não permitida.',
          OLD.processing_status, NEW.processing_status;
      END IF;
    END IF;

    -- processing_error:
    --   * só pode ser preenchido quando status final = TERMINATION_FAILED
    --   * só pode ser gravado uma vez (quando OLD é NULL)
    --   * não pode ser alterado depois de gravado
    --   * não pode coexistir com TERMINATION_PROCESSED
    IF NEW.processing_error IS DISTINCT FROM OLD.processing_error THEN
      IF OLD.processing_error IS NOT NULL THEN
        RAISE EXCEPTION 'settlement_acceptances.processing_error já registrado, imutável.';
      END IF;
      IF NEW.processing_error IS NOT NULL AND NEW.processing_status <> 'TERMINATION_FAILED' THEN
        RAISE EXCEPTION 'settlement_acceptances.processing_error só pode ser gravado quando processing_status = TERMINATION_FAILED.';
      END IF;
    END IF;

    IF NEW.processing_status = 'TERMINATION_PROCESSED' AND NEW.processing_error IS NOT NULL THEN
      RAISE EXCEPTION 'settlement_acceptances: processing_error não pode existir quando processing_status = TERMINATION_PROCESSED.';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS settlement_acceptances_immutable ON public.settlement_acceptances;
CREATE TRIGGER settlement_acceptances_immutable
  BEFORE UPDATE OR DELETE ON public.settlement_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.enforce_settlement_acceptances_immutability();
