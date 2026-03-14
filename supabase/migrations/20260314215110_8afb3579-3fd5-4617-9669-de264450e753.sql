
-- =============================================
-- ETAPA 1: SEGURANÇA CRÍTICA
-- =============================================

-- 1.1 Trigger para proteger campos sensíveis em profiles
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := OLD.is_blocked;
    NEW.bids_balance := OLD.bids_balance;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_fields();

-- 1.2 Trigger para proteger campos financeiros em partner_contracts
CREATE OR REPLACE FUNCTION public.protect_partner_contract_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    NEW.available_balance := OLD.available_balance;
    NEW.total_received := OLD.total_received;
    NEW.total_withdrawn := OLD.total_withdrawn;
    NEW.total_cap := OLD.total_cap;
    NEW.weekly_cap := OLD.weekly_cap;
    NEW.aporte_value := OLD.aporte_value;
    NEW.status := OLD.status;
    NEW.total_referral_points := OLD.total_referral_points;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_partner_contract_sensitive_fields ON public.partner_contracts;
CREATE TRIGGER protect_partner_contract_sensitive_fields
BEFORE UPDATE ON public.partner_contracts
FOR EACH ROW
EXECUTE FUNCTION public.protect_partner_contract_fields();

-- 1.3 Restringir policy SELECT de profiles
DROP POLICY IF EXISTS "Public can view profile names" ON public.profiles;

-- Função SECURITY DEFINER para buscar nome público
CREATE OR REPLACE FUNCTION public.get_public_profile(target_user_id uuid)
RETURNS TABLE(full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = target_user_id
  LIMIT 1;
$$;

-- Permitir anon ver perfis limitados (necessário para exibir nomes de vencedores)
CREATE POLICY "Public can view limited profile info"
ON public.profiles FOR SELECT
TO anon
USING (true);

-- 1.4 Proteger affiliates INSERT
DROP POLICY IF EXISTS "Users can insert their own affiliate account" ON public.affiliates;

CREATE POLICY "Users can insert own affiliate account"
ON public.affiliates FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'affiliate'
  AND status = 'pending'
);

-- 1.5 Fixar search_path nas funções existentes
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = user_uuid
    AND is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_affiliate_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.affiliates
  WHERE user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_affiliate_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.affiliates
    WHERE user_id = _user_id
      AND role = 'manager'
      AND status = 'active'
  );
$$;

-- =============================================
-- ETAPA 2: Auto-afiliado no cadastro
-- =============================================

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
  new_affiliate_code text;
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

  -- Auto-create affiliate account
  new_affiliate_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  
  INSERT INTO public.affiliates (
    user_id, affiliate_code, status, role, commission_rate, commission_type
  ) VALUES (
    NEW.id, new_affiliate_code, 'active', 'affiliate', 10.00, 'percentage'
  );
  
  RAISE LOG 'Auto-affiliate created: user % with code %', NEW.id, new_affiliate_code;
  
  -- Process referral
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
