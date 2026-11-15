CREATE TABLE public.affiliate_click_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), affiliate_id uuid NOT NULL REFERENCES public.affiliates(id), access_id uuid NOT NULL UNIQUE, is_automated boolean NOT NULL DEFAULT false, automation_reason text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.affiliate_click_events TO authenticated;
GRANT ALL ON public.affiliate_click_events TO service_role;
ALTER TABLE public.affiliate_click_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_own_click_events ON public.affiliate_click_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id=affiliate_id AND a.user_id=auth.uid()));
CREATE INDEX affiliate_click_events_period ON public.affiliate_click_events(affiliate_id,created_at);
CREATE TABLE public.affiliate_click_tracking_config (id boolean PRIMARY KEY DEFAULT true, started_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.affiliate_click_tracking_config TO authenticated;
GRANT ALL ON public.affiliate_click_tracking_config TO service_role;
ALTER TABLE public.affiliate_click_tracking_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY authenticated_tracking_start ON public.affiliate_click_tracking_config FOR SELECT TO authenticated USING (true);
INSERT INTO public.affiliate_click_tracking_config(id) VALUES(true);
CREATE FUNCTION public.record_affiliate_click(p_code text,p_access_id uuid,p_is_automated boolean,p_reason text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_affiliate uuid;
BEGIN
 IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{3,64}$' OR p_access_id IS NULL THEN RETURN false; END IF;
 SELECT id INTO v_affiliate FROM public.affiliates WHERE affiliate_code=upper(p_code) AND status='active';
 IF v_affiliate IS NULL THEN RETURN false; END IF;
 INSERT INTO public.affiliate_click_events(affiliate_id,access_id,is_automated,automation_reason) VALUES(v_affiliate,p_access_id,coalesce(p_is_automated,false),left(p_reason,100)) ON CONFLICT(access_id) DO NOTHING;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.record_affiliate_click(text,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_affiliate_click(text,uuid,boolean,text) TO service_role;