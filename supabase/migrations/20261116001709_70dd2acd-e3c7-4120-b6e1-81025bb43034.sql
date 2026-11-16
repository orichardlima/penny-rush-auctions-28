ALTER TABLE public.affiliate_click_events ADD COLUMN IF NOT EXISTS visitor_id uuid;
CREATE INDEX IF NOT EXISTS affiliate_click_events_visitor ON public.affiliate_click_events(affiliate_id, visitor_id);
CREATE OR REPLACE FUNCTION public.record_affiliate_click_v2(p_code text,p_access_id uuid,p_visitor_id uuid,p_is_automated boolean,p_reason text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_affiliate uuid;
BEGIN
 IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{3,64}$' OR p_access_id IS NULL THEN RETURN false; END IF;
 SELECT id INTO v_affiliate FROM public.affiliates WHERE affiliate_code=upper(p_code) AND status='active';
 IF v_affiliate IS NULL THEN RETURN false; END IF;
 INSERT INTO public.affiliate_click_events(affiliate_id,access_id,visitor_id,is_automated,automation_reason) VALUES(v_affiliate,p_access_id,p_visitor_id,coalesce(p_is_automated,false),left(p_reason,100)) ON CONFLICT(access_id) DO NOTHING;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.record_affiliate_click_v2(text,uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_affiliate_click_v2(text,uuid,uuid,boolean,text) TO service_role;