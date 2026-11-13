CREATE OR REPLACE FUNCTION public.enforce_complete_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  cpf_clean text;
  is_pj boolean := upper(coalesce(m->>'document_type', 'CPF')) = 'CNPJ';
BEGIN
  IF coalesce(NEW.raw_app_meta_data->>'provider', 'email') <> 'email' THEN
    RAISE EXCEPTION 'Cadastro permitido somente pelo formulário do site';
  END IF;

  IF public._is_blocked_email(NEW.email) THEN
    RAISE EXCEPTION 'E-mail temporário não é aceito. Use um e-mail pessoal.';
  END IF;

  cpf_clean := regexp_replace(coalesce(m->>'cpf', ''), '\D', '', 'g');

  IF is_pj THEN
    IF NOT public._is_valid_cnpj(cpf_clean) THEN
      RAISE EXCEPTION 'CNPJ inválido';
    END IF;
    IF length(coalesce(trim(m->>'company_name'), '')) < 3 THEN
      RAISE EXCEPTION 'Cadastro incompleto: informe a razão social';
    END IF;
  ELSE
    IF NOT public._is_valid_cpf(cpf_clean) THEN
      RAISE EXCEPTION 'CPF inválido';
    END IF;
    IF length(coalesce(trim(m->>'full_name'), '')) < 3 THEN
      RAISE EXCEPTION 'Cadastro incompleto: informe o nome completo';
    END IF;
    IF coalesce(m->>'birth_date', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Cadastro incompleto: informe a data de nascimento';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = cpf_clean
  ) THEN
    RAISE EXCEPTION 'duplicate key: % já cadastrado', CASE WHEN is_pj THEN 'CNPJ' ELSE 'CPF' END;
  END IF;

  IF length(regexp_replace(coalesce(m->>'phone', ''), '\D', '', 'g')) NOT IN (10, 11)
     OR length(regexp_replace(coalesce(m->>'cep', ''), '\D', '', 'g')) <> 8
     OR coalesce(trim(m->>'street'), '') = ''
     OR coalesce(trim(m->>'number'), '') = ''
     OR coalesce(trim(m->>'neighborhood'), '') = ''
     OR coalesce(trim(m->>'city'), '') = ''
     OR length(coalesce(trim(m->>'state'), '')) <> 2
     OR coalesce(m->>'bettor_contract_accepted', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Cadastro incompleto: preencha todos os dados no site';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  bonus_enabled boolean := false;
  bonus_amount integer := 0;
  affiliate_id_var uuid;
  existing_click_id uuid;
  validated_partner_code text := NULL;
  is_oauth boolean := false;
  has_cpf boolean := false;
BEGIN
  is_oauth := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email') <> 'email';
  has_cpf := NEW.raw_user_meta_data ->> 'cpf' IS NOT NULL
             AND TRIM(NEW.raw_user_meta_data ->> 'cpf') <> '';

  SELECT (setting_value::boolean) INTO bonus_enabled
  FROM public.system_settings
  WHERE setting_key = 'signup_bonus_enabled';

  SELECT (setting_value::integer) INTO bonus_amount
  FROM public.system_settings
  WHERE setting_key = 'signup_bonus_bids';

  IF NEW.raw_user_meta_data ->> 'partner_referral_code' IS NOT NULL
     AND TRIM(NEW.raw_user_meta_data ->> 'partner_referral_code') != '' THEN
    SELECT referral_code INTO validated_partner_code
    FROM public.partner_contracts
    WHERE referral_code = UPPER(TRIM(NEW.raw_user_meta_data ->> 'partner_referral_code'))
      AND status = 'ACTIVE'
    LIMIT 1;

    IF validated_partner_code IS NULL THEN
      RAISE LOG 'Partner referral code % not found or inactive for user %',
        NEW.raw_user_meta_data ->> 'partner_referral_code', NEW.id;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, email, cpf, phone, birth_date,
    cep, street, number, complement, neighborhood, city, state,
    bids_balance, signup_bonus_received, signup_bonus_amount, signup_bonus_date,
    referred_by_partner_code, profile_complete
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'company_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
      NEW.email
    ),
    NEW.email,
    NEW.raw_user_meta_data ->> 'cpf',
    NEW.raw_user_meta_data ->> 'phone',
    CASE WHEN NULLIF(NEW.raw_user_meta_data ->> 'birth_date', '') IS NOT NULL
      THEN (NEW.raw_user_meta_data ->> 'birth_date')::DATE ELSE NULL END,
    NEW.raw_user_meta_data ->> 'cep',
    NEW.raw_user_meta_data ->> 'street',
    NEW.raw_user_meta_data ->> 'number',
    NEW.raw_user_meta_data ->> 'complement',
    NEW.raw_user_meta_data ->> 'neighborhood',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'state',
    CASE WHEN has_cpf AND COALESCE(bonus_enabled, false) = true THEN COALESCE(bonus_amount, 0) ELSE 0 END,
    has_cpf AND COALESCE(bonus_enabled, false) AND COALESCE(bonus_amount, 0) > 0,
    CASE WHEN has_cpf AND COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0
      THEN COALESCE(bonus_amount, 0) ELSE 0 END,
    CASE WHEN has_cpf AND COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0
      THEN timezone('America/Sao_Paulo', now()) ELSE NULL END,
    validated_partner_code,
    has_cpf
  );

  IF has_cpf AND COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 THEN
    RAISE LOG 'Signup bonus granted: % bids for user % at %',
      bonus_amount, NEW.id, timezone('America/Sao_Paulo', now());
  END IF;

  IF NEW.raw_user_meta_data ->> 'referral_code' IS NOT NULL AND NEW.raw_user_meta_data ->> 'referral_code' != '' THEN
    SELECT id INTO affiliate_id_var
    FROM public.affiliates
    WHERE affiliate_code = NEW.raw_user_meta_data ->> 'referral_code'
      AND status = 'active';

    IF affiliate_id_var IS NOT NULL THEN
      SELECT id INTO existing_click_id
      FROM public.affiliate_referrals
      WHERE affiliate_id = affiliate_id_var
        AND referred_user_id IS NULL
        AND created_at > timezone('America/Sao_Paulo', now()) - INTERVAL '30 days'
      LIMIT 1;

      IF existing_click_id IS NOT NULL THEN
        UPDATE public.affiliate_referrals
        SET referred_user_id = NEW.id
        WHERE id = existing_click_id;
      ELSE
        INSERT INTO public.affiliate_referrals (
          affiliate_id, referred_user_id, converted, click_source, user_agent
        ) VALUES (
          affiliate_id_var, NEW.id, false, 'direct_signup', 'no_click_tracked'
        );

        UPDATE public.affiliates
        SET total_referrals = total_referrals + 1
        WHERE id = affiliate_id_var;
      END IF;

      UPDATE public.affiliates
      SET total_signups = total_signups + 1
      WHERE id = affiliate_id_var;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_oauth_profile(
  p_full_name text,
  p_cpf text,
  p_phone text,
  p_birth_date date,
  p_cep text,
  p_street text,
  p_number text,
  p_complement text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_partner_referral_code text DEFAULT NULL::text,
  p_affiliate_referral_code text DEFAULT NULL::text,
  p_document_type text DEFAULT 'CPF'::text,
  p_company_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_cpf_clean text;
  v_existing_cpf uuid;
  v_validated_partner_code text := NULL;
  v_bonus_enabled boolean := false;
  v_bonus_amount integer := 0;
  v_already_complete boolean;
  v_affiliate_id uuid;
  v_existing_click_id uuid;
  v_document_type text := upper(trim(COALESCE(p_document_type, 'CPF')));
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT profile_complete INTO v_already_complete
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_already_complete IS TRUE THEN
    RETURN jsonb_build_object('success', true, 'message', 'already_complete');
  END IF;

  IF v_document_type NOT IN ('CPF', 'CNPJ') THEN
    RETURN jsonb_build_object('success', false, 'error', 'document_type_invalid');
  END IF;

  v_cpf_clean := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  IF v_document_type = 'CNPJ' THEN
    IF length(v_cpf_clean) <> 14 OR NOT public._is_valid_cnpj(v_cpf_clean) THEN
      RETURN jsonb_build_object('success', false, 'error', 'cnpj_invalid');
    END IF;
    IF length(trim(COALESCE(p_company_name, ''))) < 3 THEN
      RETURN jsonb_build_object('success', false, 'error', 'company_name_required');
    END IF;
  ELSE
    IF length(v_cpf_clean) <> 11 OR NOT public._is_valid_cpf(v_cpf_clean) THEN
      RETURN jsonb_build_object('success', false, 'error', 'cpf_invalid');
    END IF;
    IF length(trim(COALESCE(p_full_name, ''))) < 3 THEN
      RETURN jsonb_build_object('success', false, 'error', 'full_name_required');
    END IF;
    IF p_birth_date IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'birth_date_required');
    END IF;
  END IF;

  SELECT user_id INTO v_existing_cpf
  FROM public.profiles
  WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_cpf_clean
    AND user_id <> v_user_id
  LIMIT 1;
  IF v_existing_cpf IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'cpf_already_used');
  END IF;

  IF p_partner_referral_code IS NOT NULL AND TRIM(p_partner_referral_code) <> '' THEN
    SELECT referral_code INTO v_validated_partner_code
    FROM public.partner_contracts
    WHERE referral_code = UPPER(TRIM(p_partner_referral_code))
      AND status = 'ACTIVE'
    LIMIT 1;
  END IF;

  SELECT (setting_value::boolean) INTO v_bonus_enabled
  FROM public.system_settings WHERE setting_key = 'signup_bonus_enabled';
  SELECT (setting_value::integer) INTO v_bonus_amount
  FROM public.system_settings WHERE setting_key = 'signup_bonus_bids';

  UPDATE public.profiles SET
    full_name = CASE
      WHEN v_document_type = 'CNPJ' THEN trim(p_company_name)
      ELSE trim(p_full_name)
    END,
    company_name = CASE WHEN v_document_type = 'CNPJ' THEN trim(p_company_name) ELSE NULL END,
    document_type = v_document_type,
    cpf = v_cpf_clean,
    phone = p_phone,
    birth_date = CASE WHEN v_document_type = 'CNPJ' THEN NULL ELSE p_birth_date END,
    cep = p_cep,
    street = p_street,
    number = p_number,
    complement = p_complement,
    neighborhood = p_neighborhood,
    city = p_city,
    state = p_state,
    referred_by_partner_code = COALESCE(referred_by_partner_code, v_validated_partner_code),
    bids_balance = CASE
      WHEN signup_bonus_received IS NOT TRUE AND COALESCE(v_bonus_enabled, false) AND COALESCE(v_bonus_amount, 0) > 0
        THEN COALESCE(bids_balance, 0) + v_bonus_amount
      ELSE bids_balance
    END,
    signup_bonus_received = CASE
      WHEN signup_bonus_received IS NOT TRUE AND COALESCE(v_bonus_enabled, false) AND COALESCE(v_bonus_amount, 0) > 0
        THEN true
      ELSE signup_bonus_received
    END,
    signup_bonus_amount = CASE
      WHEN signup_bonus_received IS NOT TRUE AND COALESCE(v_bonus_enabled, false) AND COALESCE(v_bonus_amount, 0) > 0
        THEN v_bonus_amount
      ELSE signup_bonus_amount
    END,
    signup_bonus_date = CASE
      WHEN signup_bonus_received IS NOT TRUE AND COALESCE(v_bonus_enabled, false) AND COALESCE(v_bonus_amount, 0) > 0
        THEN timezone('America/Sao_Paulo', now())
      ELSE signup_bonus_date
    END,
    profile_complete = true,
    updated_at = now()
  WHERE user_id = v_user_id;

  IF p_affiliate_referral_code IS NOT NULL AND TRIM(p_affiliate_referral_code) <> '' THEN
    SELECT id INTO v_affiliate_id
    FROM public.affiliates
    WHERE affiliate_code = TRIM(p_affiliate_referral_code)
      AND status = 'active'
    LIMIT 1;

    IF v_affiliate_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.affiliate_referrals WHERE referred_user_id = v_user_id) THEN
      SELECT id INTO v_existing_click_id
      FROM public.affiliate_referrals
      WHERE affiliate_id = v_affiliate_id
        AND referred_user_id IS NULL
        AND created_at > timezone('America/Sao_Paulo', now()) - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_existing_click_id IS NOT NULL THEN
        UPDATE public.affiliate_referrals SET referred_user_id = v_user_id WHERE id = v_existing_click_id;
      ELSE
        INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, converted, click_source, user_agent)
        VALUES (v_affiliate_id, v_user_id, false, 'oauth_signup', 'no_click_tracked');
        UPDATE public.affiliates SET total_referrals = total_referrals + 1 WHERE id = v_affiliate_id;
      END IF;

      UPDATE public.affiliates SET total_signups = total_signups + 1 WHERE id = v_affiliate_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'partner_referral_applied', v_validated_partner_code IS NOT NULL,
    'bonus_granted', v_bonus_enabled AND v_bonus_amount > 0
  );
END;
$function$;