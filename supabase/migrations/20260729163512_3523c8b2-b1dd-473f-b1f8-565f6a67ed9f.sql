
ALTER TABLE public.partner_payouts
  ADD COLUMN IF NOT EXISTS payout_type TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS source_ref TEXT,
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(18,2);

-- Backfill: tudo que já existe é repasse semanal
UPDATE public.partner_payouts
   SET payout_type = 'partnership_weekly_repass'
 WHERE payout_type IS NULL;

UPDATE public.partner_payouts
   SET gross_amount = COALESCE(gross_amount, calculated_amount, amount, 0),
       final_amount = COALESCE(final_amount, amount, calculated_amount, 0)
 WHERE gross_amount IS NULL OR final_amount IS NULL;

ALTER TABLE public.partner_payouts
  ALTER COLUMN payout_type SET NOT NULL,
  ALTER COLUMN payout_type SET DEFAULT 'partnership_weekly_repass';

-- CHECK textual (permite adicionar tipos novos sem ALTER TYPE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_payouts_payout_type_chk'
  ) THEN
    ALTER TABLE public.partner_payouts
      ADD CONSTRAINT partner_payouts_payout_type_chk
      CHECK (payout_type IN (
        'partnership_weekly_repass',
        'direct_referral_bonus',
        'indirect_referral_bonus',
        'fast_start_bonus',
        'expansion_bonus',
        'leadership_bonus'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_partner_payouts_type
  ON public.partner_payouts(payout_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_payouts_source
  ON public.partner_payouts(source_type, source_ref)
  WHERE source_type IS NOT NULL AND source_ref IS NOT NULL;
