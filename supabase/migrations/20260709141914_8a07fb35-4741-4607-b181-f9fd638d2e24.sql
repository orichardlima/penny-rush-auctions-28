CREATE OR REPLACE FUNCTION public.admin_get_partner_display_names(partner_ids uuid[])
RETURNS TABLE(id uuid, full_name text, email text, affiliate_code text, referral_code text, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem usar esta função.';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT DISTINCT unnest(partner_ids) AS partner_id
  ),
  aff AS (
    SELECT DISTINCT ON (a.user_id) a.user_id, a.affiliate_code
    FROM public.affiliates a
    WHERE a.user_id = ANY(partner_ids)
    ORDER BY a.user_id, a.created_at ASC
  ),
  pc AS (
    SELECT DISTINCT ON (c.user_id) c.user_id, c.referral_code
    FROM public.partner_contracts c
    WHERE c.user_id = ANY(partner_ids)
    ORDER BY c.user_id, c.created_at ASC
  )
  SELECT
    b.partner_id AS id,
    p.full_name,
    COALESCE(p.email, au.email) AS email,
    aff.affiliate_code,
    pc.referral_code,
    COALESCE(
      NULLIF(TRIM(p.full_name), ''),
      NULLIF(TRIM(COALESCE(p.email, au.email)), ''),
      NULLIF(TRIM(aff.affiliate_code), ''),
      NULLIF(TRIM(pc.referral_code), ''),
      'Parceiro não identificado'
    ) AS display_name
  FROM base b
  LEFT JOIN public.profiles p ON p.id = b.partner_id
  LEFT JOIN auth.users au ON au.id = b.partner_id
  LEFT JOIN aff ON aff.user_id = b.partner_id
  LEFT JOIN pc ON pc.user_id = b.partner_id;
END;
$function$;