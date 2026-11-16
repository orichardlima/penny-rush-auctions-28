CREATE TABLE public.affiliate_signup_visits (
  referred_user_id uuid PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  visitor_id uuid NOT NULL,
  visit_at timestamptz NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_signup_visits TO authenticated;
GRANT ALL ON public.affiliate_signup_visits TO service_role;
ALTER TABLE public.affiliate_signup_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_own_signup_visits ON public.affiliate_signup_visits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_signup_visits.affiliate_id AND a.user_id = auth.uid()) OR public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.link_affiliate_signup_visit(p_visitor_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_ref record; v_visit timestamptz;
BEGIN
  IF v_uid IS NULL OR p_visitor_id IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM affiliate_signup_visits WHERE referred_user_id = v_uid) THEN RETURN true; END IF;
  SELECT affiliate_id, created_at INTO v_ref FROM affiliate_referrals
   WHERE referred_user_id = v_uid ORDER BY created_at LIMIT 1;
  IF v_ref.affiliate_id IS NULL THEN RETURN false; END IF;
  SELECT min(created_at) INTO v_visit FROM affiliate_click_events
   WHERE affiliate_id = v_ref.affiliate_id AND visitor_id = p_visitor_id AND NOT is_automated
     AND created_at <= v_ref.created_at + interval '10 minutes'
     AND created_at >= v_ref.created_at - interval '30 days';
  IF v_visit IS NULL THEN RETURN false; END IF;
  INSERT INTO affiliate_signup_visits(referred_user_id, affiliate_id, visitor_id, visit_at)
  VALUES (v_uid, v_ref.affiliate_id, p_visitor_id, v_visit) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.link_affiliate_signup_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_affiliate_signup_visit(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.affiliate_click_breakdown(p_affiliate_ids uuid[] DEFAULT NULL)
RETURNS TABLE(affiliate_id uuid, measured_new bigint, measured_legacy bigint, inferred bigint, inconclusive bigint, automated bigint, total_clicks bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_admin boolean; v_start timestamptz; v_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  v_admin := public.is_admin_user(v_uid);
  SELECT started_at INTO v_start FROM affiliate_click_tracking_config WHERE id = true;
  IF v_admin THEN
    v_ids := COALESCE(p_affiliate_ids, ARRAY(SELECT id FROM affiliates));
  ELSE
    v_ids := ARRAY(
      SELECT x FROM unnest(COALESCE(p_affiliate_ids, ARRAY[]::uuid[])) x
      WHERE EXISTS (SELECT 1 FROM affiliates a WHERE a.id = x AND a.user_id = v_uid)
         OR EXISTS (SELECT 1 FROM affiliate_managers m JOIN affiliates ma ON ma.id = m.manager_affiliate_id
                    WHERE m.influencer_affiliate_id = x AND ma.user_id = v_uid));
  END IF;
  RETURN QUERY
  WITH ids AS (SELECT unnest(v_ids) id),
  ev AS (SELECT e.affiliate_id,
           count(DISTINCT COALESCE(e.visitor_id, e.access_id)) FILTER (WHERE NOT e.is_automated) m,
           count(*) FILTER (WHERE e.is_automated) au
         FROM affiliate_click_events e WHERE e.affiliate_id IN (SELECT id FROM ids) GROUP BY 1),
  rf AS (SELECT r.affiliate_id,
           count(*) FILTER (WHERE r.click_source LIKE 'http%' AND r.user_agent IS DISTINCT FROM 'no_click_tracked') ml,
           count(DISTINCT r.referred_user_id) FILTER (WHERE r.click_source = 'direct_signup' AND r.referred_user_id IS NOT NULL
               AND r.created_at < v_start + interval '30 days'
               AND NOT EXISTS (SELECT 1 FROM affiliate_signup_visits s WHERE s.referred_user_id = r.referred_user_id)) inf,
           count(*) FILTER (WHERE NOT (r.click_source LIKE 'http%' AND r.user_agent IS DISTINCT FROM 'no_click_tracked')
               AND NOT (r.click_source = 'direct_signup' AND r.referred_user_id IS NOT NULL AND r.created_at < v_start + interval '30 days')
               AND NOT EXISTS (SELECT 1 FROM affiliate_signup_visits s WHERE s.referred_user_id = r.referred_user_id)) inc
         FROM affiliate_referrals r WHERE r.affiliate_id IN (SELECT id FROM ids) GROUP BY 1)
  SELECT i.id, COALESCE(ev.m,0), COALESCE(rf.ml,0), COALESCE(rf.inf,0), COALESCE(rf.inc,0), COALESCE(ev.au,0),
         COALESCE(ev.m,0) + COALESCE(rf.ml,0) + COALESCE(rf.inf,0)
  FROM ids i LEFT JOIN ev ON ev.affiliate_id = i.id LEFT JOIN rf ON rf.affiliate_id = i.id;
END $$;
REVOKE ALL ON FUNCTION public.affiliate_click_breakdown(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_click_breakdown(uuid[]) TO authenticated, service_role;