CREATE OR REPLACE FUNCTION public.enforce_contract_acceptances_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'contract_acceptances é imutável (op=%).', TG_OP;
  END IF;
  RETURN NEW;
END;
$$;