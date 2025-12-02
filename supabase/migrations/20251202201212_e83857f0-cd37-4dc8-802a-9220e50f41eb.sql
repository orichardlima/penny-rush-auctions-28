-- 1. Adicionar coluna total_signups na tabela affiliates
ALTER TABLE public.affiliates 
ADD COLUMN IF NOT EXISTS total_signups INTEGER NOT NULL DEFAULT 0;

-- 2. Corrigir o trigger handle_new_user para incrementar total_signups (não total_referrals)
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
      
      -- CORRIGIDO: Incrementar total_signups (cadastros), não total_referrals (cliques)
      UPDATE public.affiliates
      SET total_signups = total_signups + 1
      WHERE id = affiliate_id_var;
      
      RAISE LOG 'Signup registered: user % referred by affiliate % (code: %), total_signups incremented', 
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

-- 3. Corrigir o trigger process_cpa_depositor para marcar converted = true
CREATE OR REPLACE FUNCTION public.process_cpa_depositor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affiliate_record RECORD;
  goal_record RECORD;
  is_first_purchase BOOLEAN;
  auto_renew BOOLEAN;
BEGIN
  -- Só processar se o pagamento foi completado
  IF NEW.payment_status != 'completed' THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se é a primeira compra completada do usuário
  SELECT COUNT(*) = 1 INTO is_first_purchase
  FROM public.bid_purchases
  WHERE user_id = NEW.user_id 
    AND payment_status = 'completed'
    AND id <= NEW.id;
  
  IF NOT is_first_purchase THEN
    RETURN NEW;
  END IF;
  
  RAISE LOG 'CPA: Primeira compra detectada para user_id %', NEW.user_id;
  
  -- Buscar o afiliado que indicou este usuário
  SELECT a.* INTO affiliate_record
  FROM public.affiliates a
  JOIN public.affiliate_referrals ar ON a.id = ar.affiliate_id
  WHERE ar.referred_user_id = NEW.user_id
    AND a.commission_type = 'cpa'
    AND a.status = 'active'
  LIMIT 1;
  
  IF affiliate_record.id IS NULL THEN
    RAISE LOG 'CPA: Nenhum afiliado CPA encontrado para user_id %', NEW.user_id;
    RETURN NEW;
  END IF;
  
  RAISE LOG 'CPA: Afiliado encontrado: %', affiliate_record.id;
  
  -- NOVO: Marcar o referral como convertido
  UPDATE public.affiliate_referrals
  SET converted = true
  WHERE affiliate_id = affiliate_record.id
    AND referred_user_id = NEW.user_id;
  
  RAISE LOG 'CPA: Referral marcado como convertido para user_id %', NEW.user_id;
  
  -- Buscar meta ativa do afiliado
  SELECT * INTO goal_record
  FROM public.affiliate_cpa_goals
  WHERE affiliate_id = affiliate_record.id
    AND status = 'in_progress'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se não tem meta ativa, criar uma
  IF goal_record.id IS NULL THEN
    INSERT INTO public.affiliate_cpa_goals (
      affiliate_id, 
      value_per_conversion, 
      conversions_target,
      cycle_number
    ) VALUES (
      affiliate_record.id, 
      affiliate_record.cpa_value_per_conversion,
      affiliate_record.cpa_conversions_target,
      1
    )
    RETURNING * INTO goal_record;
    
    RAISE LOG 'CPA: Nova meta criada: %', goal_record.id;
  END IF;
  
  -- Incrementar progresso
  UPDATE public.affiliate_cpa_goals
  SET 
    current_conversions = current_conversions + 1,
    updated_at = timezone('America/Sao_Paulo', now())
  WHERE id = goal_record.id;
  
  RAISE LOG 'CPA: Progresso incrementado para meta %: %/%', 
    goal_record.id, 
    goal_record.current_conversions + 1, 
    goal_record.conversions_target;
  
  -- Verificar se atingiu a meta
  IF goal_record.current_conversions + 1 >= goal_record.conversions_target THEN
    -- Completar meta
    UPDATE public.affiliate_cpa_goals
    SET 
      status = 'completed',
      completed_at = timezone('America/Sao_Paulo', now()),
      current_conversions = conversions_target
    WHERE id = goal_record.id;
    
    RAISE LOG 'CPA: Meta completada! Gerando comissão de R$ %', goal_record.total_reward;
    
    -- Gerar comissão com o valor total da meta
    INSERT INTO public.affiliate_commissions (
      affiliate_id, 
      purchase_id, 
      referred_user_id,
      purchase_amount, 
      commission_rate, 
      commission_amount, 
      status
    ) VALUES (
      affiliate_record.id, 
      NEW.id, 
      NEW.user_id,
      NEW.amount_paid,
      0,
      goal_record.total_reward,
      'pending'
    );
    
    -- Verificar se deve criar nova meta (auto-renovação)
    SELECT setting_value::boolean INTO auto_renew
    FROM public.system_settings
    WHERE setting_key = 'affiliate_cpa_auto_renew_goal';
    
    IF COALESCE(auto_renew, true) THEN
      INSERT INTO public.affiliate_cpa_goals (
        affiliate_id, 
        value_per_conversion, 
        conversions_target,
        cycle_number
      ) VALUES (
        affiliate_record.id, 
        affiliate_record.cpa_value_per_conversion,
        affiliate_record.cpa_conversions_target,
        goal_record.cycle_number + 1
      );
      
      RAISE LOG 'CPA: Nova meta (ciclo %) criada automaticamente', goal_record.cycle_number + 1;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Migrar dados existentes: Mover valor de total_referrals para total_signups onde há cadastros vinculados
-- Para o afiliado AFILIA0CB5 que tem 1 usuário cadastrado (Afiliado 2)
UPDATE public.affiliates
SET 
  total_signups = (
    SELECT COUNT(DISTINCT ar.referred_user_id) 
    FROM public.affiliate_referrals ar 
    WHERE ar.affiliate_id = affiliates.id 
      AND ar.referred_user_id IS NOT NULL
  )
WHERE id IN (
  SELECT DISTINCT ar.affiliate_id 
  FROM public.affiliate_referrals ar 
  WHERE ar.referred_user_id IS NOT NULL
);