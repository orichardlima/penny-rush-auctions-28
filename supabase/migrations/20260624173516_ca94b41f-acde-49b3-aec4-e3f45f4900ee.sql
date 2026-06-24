-- Sync triggers + backfill for partner_contracts.total_received and total_withdrawn

-- 1) Recalc function: sets both aggregates from source-of-truth tables
CREATE OR REPLACE FUNCTION public.recalc_partner_contract_totals(_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_contracts pc
  SET
    total_received = COALESCE((
      SELECT SUM(amount) FROM public.partner_payouts
      WHERE partner_contract_id = _contract_id AND status = 'PAID'
    ), 0),
    total_withdrawn = COALESCE((
      SELECT SUM(amount) FROM public.partner_withdrawals
      WHERE partner_contract_id = _contract_id AND status = 'PAID'
    ), 0),
    updated_at = now()
  WHERE pc.id = _contract_id;
END;
$$;

-- 2) Trigger on partner_payouts (INSERT/UPDATE/DELETE) -> recalc total_received
CREATE OR REPLACE FUNCTION public.trg_sync_contract_totals_from_payouts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_partner_contract_totals(OLD.partner_contract_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalc_partner_contract_totals(NEW.partner_contract_id);
  IF TG_OP = 'UPDATE' AND NEW.partner_contract_id <> OLD.partner_contract_id THEN
    PERFORM public.recalc_partner_contract_totals(OLD.partner_contract_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payouts_sync_contract_totals ON public.partner_payouts;
CREATE TRIGGER trg_payouts_sync_contract_totals
AFTER INSERT OR UPDATE OR DELETE ON public.partner_payouts
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_contract_totals_from_payouts();

-- 3) Trigger on partner_withdrawals (INSERT/UPDATE/DELETE) -> recalc total_withdrawn
CREATE OR REPLACE FUNCTION public.trg_sync_contract_totals_from_withdrawals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_partner_contract_totals(OLD.partner_contract_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalc_partner_contract_totals(NEW.partner_contract_id);
  IF TG_OP = 'UPDATE' AND NEW.partner_contract_id <> OLD.partner_contract_id THEN
    PERFORM public.recalc_partner_contract_totals(OLD.partner_contract_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_withdrawals_sync_contract_totals ON public.partner_withdrawals;
CREATE TRIGGER trg_withdrawals_sync_contract_totals
AFTER INSERT OR UPDATE OR DELETE ON public.partner_withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_contract_totals_from_withdrawals();

-- 4) Backfill for ALL existing contracts
UPDATE public.partner_contracts pc
SET
  total_received = COALESCE(pp.total, 0),
  total_withdrawn = COALESCE(pw.total, 0),
  updated_at = now()
FROM (
  SELECT id FROM public.partner_contracts
) c
LEFT JOIN (
  SELECT partner_contract_id, SUM(amount) AS total
  FROM public.partner_payouts
  WHERE status = 'PAID'
  GROUP BY partner_contract_id
) pp ON pp.partner_contract_id = c.id
LEFT JOIN (
  SELECT partner_contract_id, SUM(amount) AS total
  FROM public.partner_withdrawals
  WHERE status = 'PAID'
  GROUP BY partner_contract_id
) pw ON pw.partner_contract_id = c.id
WHERE pc.id = c.id;