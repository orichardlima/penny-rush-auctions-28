
-- 1. Recriar handle_new_user SEM a criação automática de afiliado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bonus_enabled boolean := false;
  bonus_amount integer := 0;
  affiliate_id_var uuid;
  existing_click_id uuid;
  validated_partner_code text := NULL;
BEGIN
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
    referred_by_partner_code
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
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
    CASE WHEN COALESCE(bonus_enabled, false) = true THEN COALESCE(bonus_amount, 0) ELSE 0 END,
    COALESCE(bonus_enabled, false) AND COALESCE(bonus_amount, 0) > 0,
    CASE WHEN COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 
      THEN COALESCE(bonus_amount, 0) ELSE 0 END,
    CASE WHEN COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 
      THEN timezone('America/Sao_Paulo', now()) ELSE NULL END,
    validated_partner_code
  );
  
  IF COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 THEN
    RAISE LOG 'Signup bonus granted: % bids for user % at %', 
      bonus_amount, NEW.id, timezone('America/Sao_Paulo', now());
  END IF;

  -- NOTE: Affiliate account is NO LONGER auto-created here.
  -- Only users with an active Legend partner contract can create affiliate accounts manually.
  
  -- Process referral (affiliate link tracking still works)
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
$$;

-- 2. Criar função SECURITY DEFINER para auto-aprovar afiliados após insert
CREATE OR REPLACE FUNCTION public.auto_approve_affiliate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.affiliates
  SET status = 'active',
      approved_at = timezone('America/Sao_Paulo', now())
  WHERE id = NEW.id
    AND status = 'pending';
  
  RAISE LOG 'Auto-approved affiliate % for user %', NEW.id, NEW.user_id;
  RETURN NEW;
END;
$$;

-- 3. Criar trigger AFTER INSERT para auto-aprovar
DROP TRIGGER IF EXISTS trg_auto_approve_affiliate ON public.affiliates;
CREATE TRIGGER trg_auto_approve_affiliate
  AFTER INSERT ON public.affiliates
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.auto_approve_affiliate();
