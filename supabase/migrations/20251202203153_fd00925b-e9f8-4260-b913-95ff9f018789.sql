-- Corrigir o trigger process_cpa_depositor para incrementar total_conversions
CREATE OR REPLACE FUNCTION public.process_cpa_depositor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affiliate_record RECORD;
  referral_record RECORD;
  cpa_goal RECORD;
BEGIN
  -- Só processa quando status muda para 'completed'
  IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
    
    -- Busca o referral do usuário que fez a compra
    SELECT ar.*, a.id as aff_id, a.affiliate_code, a.cpa_value_per_conversion, a.cpa_conversions_target
    INTO referral_record
    FROM public.affiliate_referrals ar
    JOIN public.affiliates a ON a.id = ar.affiliate_id
    WHERE ar.referred_user_id = NEW.user_id
    AND ar.converted = false
    LIMIT 1;
    
    -- Se encontrou um referral não convertido
    IF referral_record.aff_id IS NOT NULL THEN
      
      -- Marca o referral como convertido
      UPDATE public.affiliate_referrals
      SET converted = true
      WHERE id = referral_record.id;
      
      -- Incrementa total_conversions no afiliado
      UPDATE public.affiliates
      SET total_conversions = total_conversions + 1
      WHERE id = referral_record.aff_id;
      
      -- Busca meta CPA ativa do afiliado
      SELECT * INTO cpa_goal
      FROM public.affiliate_cpa_goals
      WHERE affiliate_id = referral_record.aff_id
      AND status = 'in_progress'
      ORDER BY cycle_number DESC
      LIMIT 1;
      
      -- Se existe meta CPA ativa, incrementa conversões
      IF cpa_goal.id IS NOT NULL THEN
        UPDATE public.affiliate_cpa_goals
        SET 
          current_conversions = current_conversions + 1,
          updated_at = timezone('America/Sao_Paulo', now()),
          -- Se atingiu a meta, marca como completada
          status = CASE 
            WHEN current_conversions + 1 >= conversions_target THEN 'completed'
            ELSE 'in_progress'
          END,
          completed_at = CASE 
            WHEN current_conversions + 1 >= conversions_target THEN timezone('America/Sao_Paulo', now())
            ELSE NULL
          END,
          total_reward = CASE 
            WHEN current_conversions + 1 >= conversions_target THEN conversions_target * value_per_conversion
            ELSE NULL
          END
        WHERE id = cpa_goal.id;
      END IF;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar dados existentes do afiliado AFILIA0CB5
UPDATE public.affiliates
SET total_conversions = 1
WHERE affiliate_code = 'AFILIA0CB5';