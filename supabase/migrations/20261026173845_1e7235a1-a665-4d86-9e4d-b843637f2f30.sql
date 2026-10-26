CREATE TABLE public.blocked_email_domains (
  domain text PRIMARY KEY,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_email_domains TO authenticated;
GRANT ALL ON public.blocked_email_domains TO service_role;
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage blocked domains" ON public.blocked_email_domains
  FOR ALL TO authenticated USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public._blocked_domains_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.domain := lower(trim(NEW.domain)); NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_blocked_domains_normalize BEFORE INSERT OR UPDATE ON public.blocked_email_domains
FOR EACH ROW EXECUTE FUNCTION public._blocked_domains_normalize();

INSERT INTO public.blocked_email_domains(domain, reason) VALUES
 ('mailnull.com','usado no ataque de 25/10'),('maxxspace.com','usado no ataque de 26/10'),
 ('mailinator.com','descartável'),('guerrillamail.com','descartável'),('guerrillamail.net','descartável'),
 ('sharklasers.com','descartável'),('10minutemail.com','descartável'),('temp-mail.org','descartável'),
 ('tempmail.com','descartável'),('tempmail.net','descartável'),('yopmail.com','descartável'),
 ('trashmail.com','descartável'),('getnada.com','descartável'),('dispostable.com','descartável'),
 ('maildrop.cc','descartável'),('throwawaymail.com','descartável'),('fakeinbox.com','descartável'),
 ('mohmal.com','descartável'),('emailondeck.com','descartável'),('mintemail.com','descartável'),
 ('tempr.email','descartável'),('discard.email','descartável'),('spamgourmet.com','descartável'),
 ('mailnesia.com','descartável'),('moakt.com','descartável'),('tmail.ws','descartável'),
 ('1secmail.com','descartável'),('1secmail.net','descartável'),('1secmail.org','descartável'),
 ('mail.tm','descartável'),('emailfake.com','descartável'),('burnermail.io','descartável')
ON CONFLICT (domain) DO NOTHING;

CREATE OR REPLACE FUNCTION public._is_blocked_email(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_email_domains b
    WHERE b.is_active AND (
      lower(split_part(coalesce(p_email,''),'@',2)) = b.domain
      OR lower(split_part(coalesce(p_email,''),'@',2)) LIKE '%.' || b.domain)
  );
$$;
REVOKE ALL ON FUNCTION public._is_blocked_email(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_complete_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m jsonb := coalesce(NEW.raw_user_meta_data,'{}'::jsonb); cpf_clean text;
BEGIN
  IF coalesce(NEW.raw_app_meta_data->>'provider','email') <> 'email' THEN
    RAISE EXCEPTION 'Cadastro permitido somente pelo formulário do site';
  END IF;
  IF public._is_blocked_email(NEW.email) THEN
    RAISE EXCEPTION 'E-mail temporário não é aceito. Use um e-mail pessoal.';
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