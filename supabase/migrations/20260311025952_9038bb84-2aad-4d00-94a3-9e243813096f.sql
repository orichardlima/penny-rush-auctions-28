
-- 1. Add referred_by_partner_code column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_partner_code TEXT;

-- 2. Update handle_new_user to save partner_referral_code from metadata
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
BEGIN
  -- Get signup bonus settings
  SELECT (setting_value::boolean) INTO bonus_enabled 
  FROM public.system_settings 
  WHERE setting_key = 'signup_bonus_enabled';
  
  SELECT (setting_value::integer) INTO bonus_amount 
  FROM public.system_settings 
  WHERE setting_key = 'signup_bonus_bids';
  
  -- Create user profile
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
    state,
    bids_balance,
    signup_bonus_received,
    signup_bonus_amount,
    signup_bonus_date,
    referred_by_partner_code
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
    NEW.raw_user_meta_data ->> 'state',
    CASE 
      WHEN COALESCE(bonus_enabled, false) = true THEN COALESCE(bonus_amount, 0)
      ELSE 0
    END,
    COALESCE(bonus_enabled, false) AND COALESCE(bonus_amount, 0) > 0,
    CASE 
      WHEN COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 
      THEN COALESCE(bonus_amount, 0)
      ELSE 0
    END,
    CASE 
      WHEN COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 
      THEN timezone('America/Sao_Paulo', now())
      ELSE NULL
    END,
    NULLIF(TRIM(UPPER(NEW.raw_user_meta_data ->> 'partner_referral_code')), '')
  );
  
  -- Log signup bonus if granted
  IF COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 THEN
    RAISE LOG 'Signup bonus granted: % bids for user % at %', 
      bonus_amount, NEW.id, timezone('America/Sao_Paulo', now());
  END IF;
  
  -- ========== PROCESSAR REFERRAL ==========
  IF NEW.raw_user_meta_data ->> 'referral_code' IS NOT NULL AND NEW.raw_user_meta_data ->> 'referral_code' != '' THEN
    -- Buscar afiliado pelo código
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
        
        RAISE LOG 'Signup linked to existing click: user % linked to click % for affiliate %', 
          NEW.id, existing_click_id, affiliate_id_var;
      ELSE
        INSERT INTO public.affiliate_referrals (
          affiliate_id, 
          referred_user_id, 
          converted,
          click_source,
          user_agent
        ) VALUES (
          affiliate_id_var, 
          NEW.id, 
          false,
          'direct_signup',
          'no_click_tracked'
        );
        
        UPDATE public.affiliates
        SET total_referrals = total_referrals + 1
        WHERE id = affiliate_id_var;
        
        RAISE LOG 'Direct signup (no click): user % registered for affiliate % - total_referrals incremented', 
          NEW.id, affiliate_id_var;
      END IF;
      
      -- Incrementar total_signups
      UPDATE public.affiliates
      SET total_signups = total_signups + 1
      WHERE id = affiliate_id_var;
      
      RAISE LOG 'Referral processed: user % referred by affiliate %', NEW.id, affiliate_id_var;
    ELSE
      RAISE LOG 'Referral code % not found or inactive for user %', 
        NEW.raw_user_meta_data ->> 'referral_code', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
