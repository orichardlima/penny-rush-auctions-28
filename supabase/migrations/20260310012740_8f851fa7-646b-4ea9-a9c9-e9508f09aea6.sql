
-- Add is_repurchase column to affiliate_commissions
ALTER TABLE public.affiliate_commissions 
ADD COLUMN is_repurchase boolean NOT NULL DEFAULT false;

-- Add repurchase_commission_rate to affiliates (individual override, null = use global)
ALTER TABLE public.affiliates 
ADD COLUMN repurchase_commission_rate numeric DEFAULT NULL;
