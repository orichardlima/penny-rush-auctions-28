CREATE OR REPLACE FUNCTION public._is_active_manager_affiliate(_affiliate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.affiliates WHERE id = _affiliate_id AND role = 'manager' AND status = 'active')
$$;
REVOKE ALL ON FUNCTION public._is_active_manager_affiliate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._is_active_manager_affiliate(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can insert own affiliate account (restricted)" ON public.affiliates;
CREATE POLICY "Users can insert own affiliate account (restricted)" ON public.affiliates
FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND status = 'pending' AND role IN ('manager','influencer') AND (
    (role = 'manager' AND EXISTS (SELECT 1 FROM public.partner_contracts pc WHERE pc.user_id = auth.uid() AND pc.status = 'ACTIVE'))
    OR (role = 'influencer' AND source_manager_affiliate_id IS NOT NULL AND public._is_active_manager_affiliate(source_manager_affiliate_id))
  )
);