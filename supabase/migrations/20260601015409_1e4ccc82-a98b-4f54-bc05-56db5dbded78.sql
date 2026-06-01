-- 1) Add profile_complete to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT true;

-- 2) Backfill: all existing profiles are complete (they came from form with CPF)
UPDATE public.profiles SET profile_complete = true WHERE profile_complete IS DISTINCT FROM true;

-- 3) Update handle_new_user to detect Google provider and create minimal profile
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
  -- Detect OAuth signup (e.g. Google) — these users don't supply CPF/address
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
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email
    ),
    NEW.email,
    NEW.raw_user_meta_data ->> 'cpf',
    NEW.raw_user_meta_data ->> 'phone',
    CASE WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'birth_date')::DATE ELSE NULL END,
    NEW.raw_user_meta_data ->> 'cep',
    NEW.raw_user_meta_data ->> 'street',
    NEW.raw_user_meta_data ->> 'number',
    NEW.raw_user_meta_data ->> 'complement',
    NEW.raw_user_meta_data ->> 'neighborhood',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'state',
    -- Signup bonus only when profile already has CPF (i.e. email signup).
    -- OAuth users will receive the bonus when they complete the profile.
    CASE WHEN has_cpf AND COALESCE(bonus_enabled, false) = true THEN COALESCE(bonus_amount, 0) ELSE 0 END,
    has_cpf AND COALESCE(bonus_enabled, false) AND COALESCE(bonus_amount, 0) > 0,
    CASE WHEN has_cpf AND COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 
      THEN COALESCE(bonus_amount, 0) ELSE 0 END,
    CASE WHEN has_cpf AND COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 
      THEN timezone('America/Sao_Paulo', now()) ELSE NULL END,
    validated_partner_code,
    -- profile_complete = true only when CPF is present in the initial signup
    has_cpf
  );
  
  IF has_cpf AND COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 THEN
    RAISE LOG 'Signup bonus granted: % bids for user % at %', 
      bonus_amount, NEW.id, timezone('America/Sao_Paulo', now());
  END IF;

  -- Process affiliate referral link tracking
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
      ORDER BY created_at DESC
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

-- 4) RPC for OAuth users to complete their profile (validates CPF, applies partner ref, grants signup bonus)
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
  p_partner_referral_code text DEFAULT NULL,
  p_affiliate_referral_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT profile_complete INTO v_already_complete
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_already_complete IS TRUE THEN
    RETURN jsonb_build_object('success', true, 'message', 'already_complete');
  END IF;

  -- Normalize CPF (digits only)
  v_cpf_clean := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  IF length(v_cpf_clean) <> 11 THEN
    RETURN jsonb_build_object('success', false, 'error', 'cpf_invalid');
  END IF;

  -- CPF must be unique
  SELECT user_id INTO v_existing_cpf
  FROM public.profiles
  WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_cpf_clean
    AND user_id <> v_user_id
  LIMIT 1;
  IF v_existing_cpf IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'cpf_already_used');
  END IF;

  -- Validate partner referral code if supplied
  IF p_partner_referral_code IS NOT NULL AND TRIM(p_partner_referral_code) <> '' THEN
    SELECT referral_code INTO v_validated_partner_code
    FROM public.partner_contracts
    WHERE referral_code = UPPER(TRIM(p_partner_referral_code))
      AND status = 'ACTIVE'
    LIMIT 1;
  END IF;

  -- Signup bonus settings
  SELECT (setting_value::boolean) INTO v_bonus_enabled 
  FROM public.system_settings WHERE setting_key = 'signup_bonus_enabled';
  SELECT (setting_value::integer) INTO v_bonus_amount 
  FROM public.system_settings WHERE setting_key = 'signup_bonus_bids';

  UPDATE public.profiles SET
    full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
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

  -- Apply affiliate referral if supplied and not yet linked
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
$$;

GRANT EXECUTE ON FUNCTION public.complete_oauth_profile(text,text,text,date,text,text,text,text,text,text,text,text,text) TO authenticated;