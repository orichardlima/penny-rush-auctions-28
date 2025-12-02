-- Criar tabela de metas CPA
CREATE TABLE IF NOT EXISTS public.affiliate_cpa_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  
  -- Configuração da meta
  goal_type TEXT NOT NULL DEFAULT 'depositors',
  value_per_conversion NUMERIC NOT NULL,
  conversions_target INTEGER NOT NULL,
  total_reward NUMERIC GENERATED ALWAYS AS (value_per_conversion * conversions_target) STORED,
  
  -- Progresso
  current_conversions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  
  -- Datas
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Histórico
  cycle_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Adicionar RLS
ALTER TABLE public.affiliate_cpa_goals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para affiliate_cpa_goals
CREATE POLICY "Affiliates can view their own CPA goals"
ON public.affiliate_cpa_goals FOR SELECT
USING (
  affiliate_id IN (
    SELECT id FROM public.affiliates WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all CPA goals"
ON public.affiliate_cpa_goals FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Adicionar colunas na tabela affiliates
ALTER TABLE public.affiliates 
ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS cpa_value_per_conversion NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cpa_conversions_target INTEGER DEFAULT 0;

-- Adicionar configurações do sistema CPA
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('affiliate_commission_type', 'percentage', 'string', 'Tipo de comissão padrão: percentage ou cpa'),
  ('affiliate_cpa_value_per_conversion', '5', 'number', 'Valor por depositante no modelo CPA (R$)'),
  ('affiliate_cpa_conversions_target', '50', 'number', 'Meta de depositantes no modelo CPA'),
  ('affiliate_cpa_auto_renew_goal', 'true', 'boolean', 'Renovar meta automaticamente após completar'),
  ('affiliate_cpa_goal_expiration_days', '0', 'number', 'Dias para expirar meta (0 = sem expiração)')
ON CONFLICT (setting_key) DO NOTHING;

-- Trigger para atualizar updated_at em affiliate_cpa_goals
CREATE OR REPLACE FUNCTION public.update_affiliate_cpa_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('America/Sao_Paulo', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER update_affiliate_cpa_goals_updated_at
BEFORE UPDATE ON public.affiliate_cpa_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_affiliate_cpa_goals_updated_at();

-- Função para processar depositante CPA
CREATE OR REPLACE FUNCTION public.process_cpa_depositor()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Trigger para processar depositante quando compra é completada
DROP TRIGGER IF EXISTS process_cpa_depositor_trigger ON public.bid_purchases;
CREATE TRIGGER process_cpa_depositor_trigger
AFTER INSERT OR UPDATE OF payment_status ON public.bid_purchases
FOR EACH ROW
WHEN (NEW.payment_status = 'completed')
EXECUTE FUNCTION public.process_cpa_depositor();