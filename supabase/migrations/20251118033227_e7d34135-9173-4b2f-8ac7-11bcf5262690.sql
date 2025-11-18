-- Criar função SQL personalizada para incrementar conversões
CREATE OR REPLACE FUNCTION public.increment_affiliate_conversions(affiliate_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.affiliates
  SET total_conversions = total_conversions + 1
  WHERE id = affiliate_uuid;
END;
$$;