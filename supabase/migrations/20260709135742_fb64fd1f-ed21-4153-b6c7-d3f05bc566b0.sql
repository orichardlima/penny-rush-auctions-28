REVOKE EXECUTE ON FUNCTION public.admin_get_partner_display_names(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_partner_display_names(uuid[]) FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_get_partner_display_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_partner_display_names(uuid[]) TO service_role;