
-- RLS policies for managers to INSERT and DELETE their own influencer links
-- Uses security definer function to check manager role without recursion

CREATE OR REPLACE FUNCTION public.is_affiliate_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.affiliates
    WHERE user_id = _user_id
      AND role = 'manager'
      AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_affiliate_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.affiliates
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Allow managers to INSERT links where they are the manager
CREATE POLICY "Managers can insert own influencer links"
ON public.affiliate_managers
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_affiliate_manager(auth.uid())
  AND manager_affiliate_id = public.get_user_affiliate_id(auth.uid())
);

-- Allow managers to DELETE their own influencer links
CREATE POLICY "Managers can delete own influencer links"
ON public.affiliate_managers
FOR DELETE
TO authenticated
USING (
  public.is_affiliate_manager(auth.uid())
  AND manager_affiliate_id = public.get_user_affiliate_id(auth.uid())
);

-- Add CHECK constraint for override_rate
ALTER TABLE public.affiliate_managers
ADD CONSTRAINT override_rate_range CHECK (override_rate >= 0 AND override_rate <= 50);
