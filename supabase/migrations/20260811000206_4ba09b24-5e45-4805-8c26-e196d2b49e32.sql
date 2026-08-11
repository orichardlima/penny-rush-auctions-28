DROP INDEX IF EXISTS public.idx_partner_payouts_weekly_unique;
CREATE UNIQUE INDEX idx_partner_payouts_weekly_unique
  ON public.partner_payouts (partner_contract_id, period_start, period_end)
  WHERE (source = 'weekly_aporte'::text);