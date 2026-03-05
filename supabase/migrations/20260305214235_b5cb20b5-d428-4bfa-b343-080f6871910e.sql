
-- Add role and recruited_by_affiliate_id columns to affiliates
ALTER TABLE public.affiliates 
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'affiliate',
  ADD COLUMN IF NOT EXISTS recruited_by_affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL;

-- Create affiliate_managers table
CREATE TABLE public.affiliate_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  influencer_affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  override_rate numeric NOT NULL DEFAULT 2.00,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  UNIQUE(influencer_affiliate_id)
);

-- Enable RLS
ALTER TABLE public.affiliate_managers ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage all
CREATE POLICY "Admins can manage affiliate_managers"
  ON public.affiliate_managers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));

-- RLS: Managers can view their own links
CREATE POLICY "Managers can view own influencers"
  ON public.affiliate_managers FOR SELECT
  USING (manager_affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- RLS: Influencers can view their own link
CREATE POLICY "Influencers can view own manager"
  ON public.affiliate_managers FOR SELECT
  USING (influencer_affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- Create trigger function to generate override commission when influencer commission is created
CREATE OR REPLACE FUNCTION public.generate_override_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_link affiliate_managers%ROWTYPE;
  v_override_amount numeric;
BEGIN
  -- Check if the affiliate (who got this commission) is an influencer with an active manager
  SELECT am.* INTO v_manager_link
  FROM affiliate_managers am
  WHERE am.influencer_affiliate_id = NEW.affiliate_id
    AND am.status = 'active';

  -- If no active manager link found, do nothing
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Calculate override: override_rate% of the purchase_amount
  v_override_amount := ROUND((NEW.purchase_amount * v_manager_link.override_rate / 100), 2);

  -- Only create override if amount > 0
  IF v_override_amount > 0 THEN
    INSERT INTO affiliate_commissions (
      affiliate_id,
      referred_user_id,
      purchase_id,
      purchase_amount,
      commission_rate,
      commission_amount,
      status
    ) VALUES (
      v_manager_link.manager_affiliate_id,
      NEW.referred_user_id,
      NEW.purchase_id,
      NEW.purchase_amount,
      v_manager_link.override_rate,
      v_override_amount,
      'pending'
    );

    -- Update manager's balance
    UPDATE affiliates
    SET 
      total_commission_earned = total_commission_earned + v_override_amount,
      commission_balance = commission_balance + v_override_amount
    WHERE id = v_manager_link.manager_affiliate_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_generate_override_commission ON public.affiliate_commissions;
CREATE TRIGGER trg_generate_override_commission
  AFTER INSERT ON public.affiliate_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_override_commission();
