-- Create partner_levels table for graduation levels
CREATE TABLE public.partner_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  icon TEXT NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  bonus_percentage_increase NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Create partner_level_points table for points per plan
CREATE TABLE public.partner_level_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL UNIQUE,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Add total_referral_points column to partner_contracts
ALTER TABLE public.partner_contracts 
ADD COLUMN total_referral_points INTEGER NOT NULL DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.partner_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_level_points ENABLE ROW LEVEL SECURITY;

-- RLS policies for partner_levels
CREATE POLICY "Anyone can view active partner levels" 
ON public.partner_levels 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage partner levels" 
ON public.partner_levels 
FOR ALL 
USING (is_admin_user(auth.uid()));

-- RLS policies for partner_level_points
CREATE POLICY "Anyone can view partner level points" 
ON public.partner_level_points 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage partner level points" 
ON public.partner_level_points 
FOR ALL 
USING (is_admin_user(auth.uid()));

-- Insert default levels
INSERT INTO public.partner_levels (name, display_name, icon, min_points, color, bonus_percentage_increase, sort_order) VALUES
('INICIANTE', 'Iniciante', '🌱', 0, 'gray-500', 0, 0),
('BRONZE', 'Bronze', '🥉', 100, 'orange-600', 1, 1),
('PRATA', 'Prata', '🥈', 250, 'slate-400', 2, 2),
('OURO', 'Ouro', '🥇', 500, 'yellow-500', 3, 3),
('PLATINA', 'Platina', '💫', 1000, 'purple-500', 5, 4),
('DIAMANTE', 'Diamante', '💎', 2500, 'cyan-400', 7, 5);

-- Insert default points per plan
INSERT INTO public.partner_level_points (plan_name, points) VALUES
('START', 50),
('PRO', 150),
('ELITE', 400);

-- Create function to update partner points when referral bonus is created
CREATE OR REPLACE FUNCTION public.update_partner_referral_points()
RETURNS TRIGGER AS $$
DECLARE
  referred_plan_name TEXT;
  points_to_add INTEGER;
BEGIN
  -- Get the plan name from the referred contract
  SELECT plan_name INTO referred_plan_name
  FROM public.partner_contracts
  WHERE id = NEW.referred_contract_id;

  -- Get points for this plan
  SELECT points INTO points_to_add
  FROM public.partner_level_points
  WHERE UPPER(plan_name) = UPPER(referred_plan_name);

  -- If no points configured, default to 0
  IF points_to_add IS NULL THEN
    points_to_add := 0;
  END IF;

  -- Update the referrer's total points
  UPDATE public.partner_contracts
  SET total_referral_points = total_referral_points + points_to_add,
      updated_at = timezone('America/Sao_Paulo', now())
  WHERE id = NEW.referrer_contract_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update points on referral bonus creation
CREATE TRIGGER on_partner_referral_bonus_created
AFTER INSERT ON public.partner_referral_bonuses
FOR EACH ROW
EXECUTE FUNCTION public.update_partner_referral_points();