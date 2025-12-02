-- 1. Criar função e trigger para incrementar cliques automaticamente
CREATE OR REPLACE FUNCTION public.increment_affiliate_clicks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Incrementa total_referrals APENAS quando é um clique puro (sem referred_user_id)
  -- Isso evita duplicação quando o handle_new_user atualiza o registro
  IF NEW.referred_user_id IS NULL THEN
    UPDATE public.affiliates
    SET total_referrals = total_referrals + 1
    WHERE id = NEW.affiliate_id;
    
    RAISE LOG 'Click registered for affiliate %: total_referrals incremented', NEW.affiliate_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para cliques
DROP TRIGGER IF EXISTS on_affiliate_click ON public.affiliate_referrals;
CREATE TRIGGER on_affiliate_click
  AFTER INSERT ON public.affiliate_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_affiliate_clicks();

-- 2. Corrigir o trigger handle_new_user para não criar novo registro de referral
-- mas sim atualizar o registro de clique existente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
      -- NOVO: Buscar clique existente (registro sem referred_user_id) para este afiliado
      -- usando IP ou user_agent como referência (se disponível no localStorage/cookie do cliente)
      SELECT id INTO existing_click_id
      FROM public.affiliate_referrals
      WHERE affiliate_id = affiliate_id_var
        AND referred_user_id IS NULL
        AND created_at > timezone('America/Sao_Paulo', now()) - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 1;
      
      IF existing_click_id IS NOT NULL THEN
        -- ATUALIZAR registro de clique existente com o user_id
        UPDATE public.affiliate_referrals
        SET referred_user_id = NEW.id
        WHERE id = existing_click_id;
        
        RAISE LOG 'Signup linked to existing click: user % linked to click % for affiliate %', 
          NEW.id, existing_click_id, affiliate_id_var;
      ELSE
        -- Se não há clique registrado, criar novo registro (cadastro direto sem clique rastreado)
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
        
        -- Incrementar total_referrals para manter consistência (1 cadastro = mínimo 1 clique)
        UPDATE public.affiliates
        SET total_referrals = total_referrals + 1
        WHERE id = affiliate_id_var;
        
        RAISE LOG 'Direct signup (no click): user % registered for affiliate % - total_referrals incremented', 
          NEW.id, affiliate_id_var;
      END IF;
      
      -- Incrementar total_signups (cadastros)
      UPDATE public.affiliates
      SET total_signups = total_signups + 1
      WHERE id = affiliate_id_var;
      
      RAISE LOG 'Signup registered: user % for affiliate % (code: %), total_signups incremented', 
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
$$;

-- 3. Corrigir dados existentes do afiliado AFILIA0CB5
-- Como temos 2 cadastros e os cliques não foram rastreados, definir total_referrals = 2
UPDATE public.affiliates
SET total_referrals = 2
WHERE affiliate_code = 'AFILIA0CB5';