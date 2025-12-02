-- Atualizar trigger handle_new_user para processar referrals
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
    signup_bonus_date
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
    END
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
      -- Criar registro de referral com referred_user_id
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
        'signup_form',
        'direct_signup'
      );
      
      -- Incrementar total_referrals do afiliado
      UPDATE public.affiliates
      SET total_referrals = total_referrals + 1
      WHERE id = affiliate_id_var;
      
      RAISE LOG 'Referral registered: user % referred by affiliate % (code: %)', 
        NEW.id, affiliate_id_var, NEW.raw_user_meta_data ->> 'referral_code';
    ELSE
      RAISE LOG 'Referral code not found or inactive: %', NEW.raw_user_meta_data ->> 'referral_code';
    END IF;
  END IF;
  -- ========== FIM PROCESSAR REFERRAL ==========
  
  -- Send welcome email asynchronously
  PERFORM net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
    ),
    body := jsonb_build_object(
      'type', 'welcome',
      'to', NEW.email,
      'data', jsonb_build_object(
        'userName', COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuário'),
        'bonusAmount', CASE 
          WHEN COALESCE(bonus_enabled, false) = true THEN COALESCE(bonus_amount, 0)
          ELSE 0
        END,
        'hasBonus', COALESCE(bonus_enabled, false) AND COALESCE(bonus_amount, 0) > 0
      )
    )
  );
  
  RAISE LOG 'Welcome email triggered for user %', NEW.email;
  
  RETURN NEW;
END;
$function$;

-- Corrigir dados existentes: vincular Afiliado 2 ao AFILIA0CB5
-- Primeiro verificar se já não existe o vínculo
INSERT INTO public.affiliate_referrals (
  affiliate_id, 
  referred_user_id, 
  converted,
  click_source,
  user_agent
)
SELECT 
  '03968a4a-4ecc-4945-ac72-4f9dbb4a39c7', -- AFILIA0CB5
  '8350319b-8992-4032-aa94-bc2c975b5b30', -- Afiliado 2
  false,
  'manual_fix',
  'migration'
WHERE NOT EXISTS (
  SELECT 1 FROM public.affiliate_referrals 
  WHERE affiliate_id = '03968a4a-4ecc-4945-ac72-4f9dbb4a39c7'
  AND referred_user_id = '8350319b-8992-4032-aa94-bc2c975b5b30'
);

-- Incrementar total_referrals apenas se o vínculo foi criado
UPDATE public.affiliates
SET total_referrals = total_referrals + 1
WHERE id = '03968a4a-4ecc-4945-ac72-4f9dbb4a39c7'
AND EXISTS (
  SELECT 1 FROM public.affiliate_referrals 
  WHERE affiliate_id = '03968a4a-4ecc-4945-ac72-4f9dbb4a39c7'
  AND referred_user_id = '8350319b-8992-4032-aa94-bc2c975b5b30'
)
AND total_referrals = 0; -- Apenas se ainda não foi incrementado