CREATE OR REPLACE FUNCTION public.set_bettor_contract_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
BEGIN
  IF NEW.bettor_contract_accepted_at IS NULL THEN
    SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = NEW.user_id;
    IF meta IS NOT NULL AND (meta ->> 'bettor_contract_accepted') = 'true' THEN
      NEW.bettor_contract_accepted_at := now();
      NEW.bettor_contract_version := COALESCE(meta ->> 'bettor_contract_version', 'v1');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_bettor_contract_meta ON public.profiles;
CREATE TRIGGER trg_set_bettor_contract_meta
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_bettor_contract_meta();