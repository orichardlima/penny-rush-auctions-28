
-- 1) Estornar payouts cujos bônus referenciados estão CANCELLED
UPDATE public.partner_payouts pp
SET status = 'CANCELLED'
FROM public.partner_referral_bonuses prb
WHERE pp.referral_bonus_id = prb.id
  AND pp.source = 'referral_bonus'
  AND pp.status = 'PAID'
  AND prb.status = 'CANCELLED';

-- 2) Recalcular total_received de contratos afetados
UPDATE public.partner_contracts pc
SET total_received = COALESCE(sub.total, 0)
FROM (
  SELECT partner_contract_id, SUM(amount) AS total
  FROM public.partner_payouts
  WHERE status = 'PAID'
  GROUP BY partner_contract_id
) sub
WHERE pc.id = sub.partner_contract_id;

-- Contratos sem nenhum payout PAID
UPDATE public.partner_contracts pc
SET total_received = 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.partner_payouts pp
  WHERE pp.partner_contract_id = pc.id AND pp.status = 'PAID'
);

-- 3) Salvaguarda: trigger BEFORE INSERT em partner_payouts
CREATE OR REPLACE FUNCTION public.enforce_referral_bonus_payout_cutoff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus_status TEXT;
BEGIN
  IF NEW.source = 'referral_bonus' AND NEW.referral_bonus_id IS NOT NULL THEN
    SELECT status INTO v_bonus_status
    FROM public.partner_referral_bonuses
    WHERE id = NEW.referral_bonus_id;

    IF v_bonus_status = 'CANCELLED' THEN
      NEW.status := 'CANCELLED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_referral_bonus_payout_cutoff ON public.partner_payouts;
CREATE TRIGGER trg_enforce_referral_bonus_payout_cutoff
BEFORE INSERT ON public.partner_payouts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_referral_bonus_payout_cutoff();
