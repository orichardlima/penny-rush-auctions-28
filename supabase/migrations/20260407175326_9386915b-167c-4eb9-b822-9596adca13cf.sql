-- Add source_event column to partner_referral_bonuses
ALTER TABLE public.partner_referral_bonuses
ADD COLUMN IF NOT EXISTS source_event text NOT NULL DEFAULT 'activation';

-- Drop old unique constraint
ALTER TABLE public.partner_referral_bonuses
DROP CONSTRAINT IF EXISTS unique_referral_bonus_per_contract_level;

-- Create new unique constraint including source_event
ALTER TABLE public.partner_referral_bonuses
ADD CONSTRAINT unique_referral_bonus_per_contract_level
UNIQUE (referred_contract_id, referral_level, is_fast_start_bonus, source_event);