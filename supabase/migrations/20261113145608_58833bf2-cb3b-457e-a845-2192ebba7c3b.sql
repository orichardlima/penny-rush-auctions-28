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
  p_document_type text DEFAULT 'CPF',
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
    IF NULLIF(trim(COALESCE(p_company_name, '')), '') IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'company_name_required');
    END IF;
  ELSIF length(v_cpf_clean) <> 11 OR NOT public._is_valid_cpf(v_cpf_clean) THEN
    RETURN jsonb_build_object('success', false, 'error', 'cpf_invalid');
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
    full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
    company_name = CASE WHEN v_document_type = 'CNPJ' THEN trim(p_company_name) ELSE NULL END,
    document_type = v_document_type,
    cpf = p_cpf,
    phone = p_phone,
    birth_date = p_birth_date,
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

REVOKE ALL ON FUNCTION public.complete_oauth_profile(text,text,text,date,text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_oauth_profile(text,text,text,date,text,text,text,text,text,text,text,text,text,text,text) TO authenticated, service_role;