-- =============================================
-- SECURITY FIX 1: Profiles - Remove anon access, add WITH CHECK
-- =============================================

DROP POLICY IF EXISTS "Public can view limited profile info" ON public.profiles;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND is_admin = false
    AND COALESCE(is_bot, false) = false
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (is_admin = false OR is_admin_user(auth.uid()))
    AND (COALESCE(is_bot, false) = false OR is_admin_user(auth.uid()))
  );

-- =============================================
-- SECURITY FIX 2: Partner contracts - restrict public policy
-- =============================================

DROP POLICY IF EXISTS "Anyone can view active contracts by referral_code" ON public.partner_contracts;

CREATE OR REPLACE FUNCTION public.get_contract_by_referral_code(code text)
RETURNS TABLE(id uuid, referral_code text, plan_name text, user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pc.id, pc.referral_code, pc.plan_name, pc.user_id
  FROM public.partner_contracts pc
  WHERE pc.referral_code = code
    AND pc.status = 'ACTIVE'
  LIMIT 1;
$$;

-- =============================================
-- SECURITY FIX 3: Bids - restrict to authenticated
-- =============================================

DROP POLICY IF EXISTS "Anyone can view all bids" ON public.bids;
CREATE POLICY "Authenticated can view all bids"
  ON public.bids FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- SECURITY FIX 4: Fury vault qualifications - remove anon access
-- =============================================

DROP POLICY IF EXISTS "Anyone can view qualification counts" ON public.fury_vault_qualifications;

-- =============================================
-- SECURITY FIX 5: Weekly revenue snapshots - restrict to authenticated
-- =============================================

DROP POLICY IF EXISTS "Anyone can view revenue snapshots" ON public.weekly_revenue_snapshots;
CREATE POLICY "Authenticated can view revenue snapshots"
  ON public.weekly_revenue_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- SECURITY FIX 6: System settings - restrict to authenticated
-- =============================================

DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
CREATE POLICY "Authenticated can read system settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- SECURITY FIX 7: Fix remaining 4 functions without search_path
-- =============================================

ALTER FUNCTION public.close_binary_cycle SET search_path = public;
ALTER FUNCTION public.get_binary_tree SET search_path = public;
ALTER FUNCTION public.prevent_bids_on_inactive_auctions SET search_path = public;
ALTER FUNCTION public.preview_binary_cycle_closure SET search_path = public;