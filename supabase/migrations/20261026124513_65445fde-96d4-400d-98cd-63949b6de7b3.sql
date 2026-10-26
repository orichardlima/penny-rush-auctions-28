CREATE OR REPLACE FUNCTION public._is_valid_cpf(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE c text := regexp_replace(coalesce(p,''),'\D','','g'); s int; d1 int; d2 int; i int;
BEGIN
  IF length(c) <> 11 OR c ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s := 0; FOR i IN 1..9 LOOP s := s + substr(c,i,1)::int * (11-i); END LOOP;
  d1 := 11 - (s % 11); IF d1 > 9 THEN d1 := 0; END IF;
  s := 0; FOR i IN 1..10 LOOP s := s + substr(c,i,1)::int * (12-i); END LOOP;
  d2 := 11 - (s % 11); IF d2 > 9 THEN d2 := 0; END IF;
  RETURN substr(c,10,1)::int = d1 AND substr(c,11,1)::int = d2;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_complete_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m jsonb := coalesce(NEW.raw_user_meta_data,'{}'::jsonb); cpf_clean text;
BEGIN
  IF coalesce(NEW.raw_app_meta_data->>'provider','email') <> 'email' THEN
    RAISE EXCEPTION 'Cadastro permitido somente pelo formulário do site';
  END IF;
  cpf_clean := regexp_replace(coalesce(m->>'cpf',''),'\D','','g');
  IF NOT public._is_valid_cpf(cpf_clean) THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE regexp_replace(coalesce(cpf,''),'\D','','g') = cpf_clean) THEN
    RAISE EXCEPTION 'duplicate key: CPF já cadastrado';
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

DROP TRIGGER IF EXISTS trg_enforce_complete_signup ON auth.users;
CREATE TRIGGER trg_enforce_complete_signup
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_complete_signup();