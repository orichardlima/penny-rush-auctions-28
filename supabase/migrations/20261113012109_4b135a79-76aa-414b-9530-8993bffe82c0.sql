ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'CPF',
  ADD COLUMN IF NOT EXISTS company_name text;

CREATE OR REPLACE FUNCTION public._is_valid_cnpj(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE d text := regexp_replace(coalesce(p,''),'\D','','g'); s int; r int; i int;
  w1 int[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2]; w2 int[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
BEGIN
  IF length(d) <> 14 OR d ~ '^(\d)\1+$' THEN RETURN false; END IF;
  s := 0; FOR i IN 1..12 LOOP s := s + substr(d,i,1)::int * w1[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  IF r <> substr(d,13,1)::int THEN RETURN false; END IF;
  s := 0; FOR i IN 1..13 LOOP s := s + substr(d,i,1)::int * w2[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  RETURN r = substr(d,14,1)::int;
END $$;
REVOKE ALL ON FUNCTION public._is_valid_cnpj(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_complete_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m jsonb := coalesce(NEW.raw_user_meta_data,'{}'::jsonb); cpf_clean text;
  is_pj boolean := coalesce(m->>'document_type','CPF') = 'CNPJ';
BEGIN
  IF coalesce(NEW.raw_app_meta_data->>'provider','email') <> 'email' THEN
    RAISE EXCEPTION 'Cadastro permitido somente pelo formulário do site';
  END IF;
  IF public._is_blocked_email(NEW.email) THEN
    RAISE EXCEPTION 'E-mail temporário não é aceito. Use um e-mail pessoal.';
  END IF;
  cpf_clean := regexp_replace(coalesce(m->>'cpf',''),'\D','','g');
  IF is_pj THEN
    IF NOT public._is_valid_cnpj(cpf_clean) THEN RAISE EXCEPTION 'CNPJ inválido'; END IF;
    IF length(coalesce(trim(m->>'company_name'),'')) < 3 THEN RAISE EXCEPTION 'Cadastro incompleto: informe a razão social'; END IF;
  ELSE
    IF NOT public._is_valid_cpf(cpf_clean) THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE regexp_replace(coalesce(cpf,''),'\D','','g') = cpf_clean) THEN
    RAISE EXCEPTION 'duplicate key: % já cadastrado', CASE WHEN is_pj THEN 'CNPJ' ELSE 'CPF' END;
  END IF;
  IF length(coalesce(trim(m->>'full_name'),'')) < 3
     OR length(regexp_replace(coalesce(m->>'phone',''),'\D','','g')) NOT IN (10,11)
     OR coalesce(m->>'birth_date','') !~ '^\d{4}-\d{2}-\d{2}$'
     OR length(regexp_replace(coalesce(m->>'cep',''),'\D','','g')) <> 8
     OR coalesce(trim(m->>'street'),'') = '' OR coalesce(trim(m->>'number'),'') = ''
     OR coalesce(trim(m->>'neighborhood'),'') = '' OR coalesce(trim(m->>'city'),'') = ''
     OR length(coalesce(trim(m->>'state'),'')) <> 2
     OR coalesce(m->>'bettor_contract_accepted','false') <> 'true' THEN
    RAISE EXCEPTION 'Cadastro incompleto: preencha todos os dados no site';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_complete_signup() FROM PUBLIC, anon, authenticated;

-- Fill document type/company on profile creation from signup metadata (server-side only)
CREATE OR REPLACE FUNCTION public._profiles_set_document_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m jsonb;
BEGIN
  SELECT raw_user_meta_data INTO m FROM auth.users WHERE id = NEW.user_id;
  IF coalesce(m->>'document_type','CPF') = 'CNPJ'
     AND public._is_valid_cnpj(NEW.cpf) THEN
    NEW.document_type := 'CNPJ';
    NEW.company_name := left(trim(m->>'company_name'), 200);
  ELSE
    NEW.document_type := 'CPF';
    NEW.company_name := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._profiles_set_document_type() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_profiles_set_document_type ON public.profiles;
CREATE TRIGGER trg_profiles_set_document_type BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public._profiles_set_document_type();

-- Users cannot change their document type afterwards
CREATE OR REPLACE FUNCTION public._profiles_lock_document_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (NEW.document_type IS DISTINCT FROM OLD.document_type OR NEW.company_name IS DISTINCT FROM OLD.company_name)
     AND NOT public.has_role(auth.uid(), 'admin') AND auth.uid() IS NOT NULL THEN
    NEW.document_type := OLD.document_type; NEW.company_name := OLD.company_name;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._profiles_lock_document_type() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_profiles_lock_document_type ON public.profiles;
CREATE TRIGGER trg_profiles_lock_document_type BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public._profiles_lock_document_type();

CREATE OR REPLACE FUNCTION public._profile_data_complete(p profiles)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT coalesce(regexp_replace(p.cpf,'\D','','g') ~ (CASE WHEN p.document_type = 'CNPJ' THEN '^\d{14}$' ELSE '^\d{11}$' END), false)
     AND length(coalesce(trim(p.phone),'')) >= 10
     AND length(coalesce(nullif(trim(p.cep),''), trim(p.address_zip),'')) >= 8
     AND coalesce(nullif(trim(p.street),''), nullif(trim(p.address_street),'')) IS NOT NULL
     AND coalesce(nullif(trim(p.city),''), nullif(trim(p.address_city),'')) IS NOT NULL
$function$;