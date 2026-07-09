CREATE OR REPLACE FUNCTION public.admin_get_partner_display_names(partner_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  affiliate_code text,
  referral_code text,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas administradores podem executar
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem usar esta função.';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT unnest(partner_ids) AS partner_id
  )
  SELECT
    b.partner_id AS id,
    p.full_name,
    COALESCE(p.email, au.email) AS email,
    a.affiliate_code,
    pc.referral_code,
    COALESCE(
      NULLIF(TRIM(p.full_name), ''),
      NULLIF(TRIM(COALESCE(p.email, au.email)), ''),
      NULLIF(TRIM(a.affiliate_code), ''),
      NULLIF(TRIM(pc.referral_code), ''),
      'Parceiro não identificado'
    ) AS display_name
  FROM base b
  LEFT JOIN public.profiles p ON p.id = b.partner_id
  LEFT JOIN auth.users au ON au.id = b.partner_id
  LEFT JOIN public.affiliates a ON a.user_id = b.partner_id
  LEFT JOIN public.partner_contracts pc ON pc.user_id = b.partner_id;
END;
$$;

-- Grant necessário para que authenticated (admin) possa chamar a função via PostgREST
GRANT EXECUTE ON FUNCTION public.admin_get_partner_display_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_partner_display_names(uuid[]) TO service_role;