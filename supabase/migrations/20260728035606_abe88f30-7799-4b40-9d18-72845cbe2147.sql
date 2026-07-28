REVOKE ALL ON FUNCTION public.points_audit_audience_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.points_audit_audience_change() TO service_role;