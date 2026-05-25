-- 1) Drop old unique constraint that blocks multiple payouts per day
ALTER TABLE public.partner_payouts
  DROP CONSTRAINT IF EXISTS partner_payouts_partner_contract_id_month_key;

-- 2) Add new columns
ALTER TABLE public.partner_payouts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'weekly_aporte';

ALTER TABLE public.partner_payouts
  ADD COLUMN IF NOT EXISTS referral_bonus_id UUID REFERENCES public.partner_referral_bonuses(id) ON DELETE SET NULL;

-- 3) Partial unique only on weekly aporte (allows many referral_bonus on same day)
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_payouts_weekly_unique
  ON public.partner_payouts(partner_contract_id, period_start)
  WHERE source = 'weekly_aporte';

-- 4) Full unique on referral_bonus_id to prevent duplicate credit
ALTER TABLE public.partner_payouts
  DROP CONSTRAINT IF EXISTS partner_payouts_referral_bonus_id_key;
ALTER TABLE public.partner_payouts
  ADD CONSTRAINT partner_payouts_referral_bonus_id_key UNIQUE (referral_bonus_id);

-- 5) Updated release function
CREATE OR REPLACE FUNCTION public.release_pending_referral_bonuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bonus RECORD;
  released_count integer := 0;
BEGIN
  FOR v_bonus IN
    SELECT id, referrer_contract_id, bonus_value, available_at
    FROM public.partner_referral_bonuses
    WHERE status = 'PENDING'
      AND available_at IS NOT NULL
      AND available_at <= now()
    FOR UPDATE
  LOOP
    UPDATE public.partner_referral_bonuses
       SET status = 'AVAILABLE'
     WHERE id = v_bonus.id;

    IF v_bonus.referrer_contract_id IS NOT NULL AND v_bonus.bonus_value > 0 THEN
      INSERT INTO public.partner_payouts (
        partner_contract_id, period_start, period_end,
        calculated_amount, amount, status, paid_at, source, referral_bonus_id
      ) VALUES (
        v_bonus.referrer_contract_id,
        v_bonus.available_at::date,
        v_bonus.available_at::date,
        v_bonus.bonus_value,
        v_bonus.bonus_value,
        'PAID',
        timezone('America/Sao_Paulo', now()),
        'referral_bonus',
        v_bonus.id
      )
      ON CONFLICT (referral_bonus_id) DO NOTHING;
    END IF;

    released_count := released_count + 1;
  END LOOP;

  RETURN released_count;
END;
$function$;

-- 6) Backfill orphaned AVAILABLE bonuses
INSERT INTO public.partner_payouts (
  partner_contract_id, period_start, period_end,
  calculated_amount, amount, status, paid_at, source, referral_bonus_id
)
SELECT
  prb.referrer_contract_id,
  COALESCE(prb.available_at, prb.created_at)::date,
  COALESCE(prb.available_at, prb.created_at)::date,
  prb.bonus_value,
  prb.bonus_value,
  'PAID',
  COALESCE(prb.available_at, prb.created_at),
  'referral_bonus',
  prb.id
FROM public.partner_referral_bonuses prb
WHERE prb.status = 'AVAILABLE'
  AND prb.referrer_contract_id IS NOT NULL
  AND prb.bonus_value > 0
ON CONFLICT (referral_bonus_id) DO NOTHING;