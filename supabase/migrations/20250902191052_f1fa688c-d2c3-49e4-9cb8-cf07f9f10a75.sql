-- Expandir tabela profiles com dados pessoais e endereço
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS number TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT;

-- Adicionar índice para CPF (único)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf) WHERE cpf IS NOT NULL;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do usuário (documento brasileiro)';
COMMENT ON COLUMN public.profiles.phone IS 'Telefone do usuário';
COMMENT ON COLUMN public.profiles.birth_date IS 'Data de nascimento';
COMMENT ON COLUMN public.profiles.cep IS 'CEP do endereço';
COMMENT ON COLUMN public.profiles.street IS 'Logradouro (rua)';
COMMENT ON COLUMN public.profiles.number IS 'Número do endereço';
COMMENT ON COLUMN public.profiles.complement IS 'Complemento do endereço';
COMMENT ON COLUMN public.profiles.neighborhood IS 'Bairro';
COMMENT ON COLUMN public.profiles.city IS 'Cidade';
COMMENT ON COLUMN public.profiles.state IS 'Estado (UF)';

-- Atualizar função handle_new_user para processar novos campos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    email,
    cpf,
    phone,
    birth_date,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    NEW.raw_user_meta_data ->> 'cpf',
    NEW.raw_user_meta_data ->> 'phone',
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'birth_date')::DATE 
      ELSE NULL 
    END,
    NEW.raw_user_meta_data ->> 'cep',
    NEW.raw_user_meta_data ->> 'street',
    NEW.raw_user_meta_data ->> 'number',
    NEW.raw_user_meta_data ->> 'complement',
    NEW.raw_user_meta_data ->> 'neighborhood',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'state'
  );
  RETURN NEW;
END;
$function$;