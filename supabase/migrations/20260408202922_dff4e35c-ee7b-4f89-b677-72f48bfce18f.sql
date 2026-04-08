
CREATE OR REPLACE FUNCTION public.get_affiliate_referral_contacts(
  _affiliate_id uuid,
  _user_ids uuid[]
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.email,
    p.phone
  FROM profiles p
  WHERE p.user_id = ANY(_user_ids)
    -- Validate caller owns this affiliate account
    AND EXISTS (
      SELECT 1 FROM affiliates a
      WHERE a.id = _affiliate_id
        AND a.user_id = auth.uid()
    )
    -- Validate each user_id is actually a referral of this affiliate
    AND EXISTS (
      SELECT 1 FROM affiliate_referrals ar
      WHERE ar.affiliate_id = _affiliate_id
        AND ar.referred_user_id = p.user_id
    );
$$;
