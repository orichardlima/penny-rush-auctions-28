-- 1. Adicionar colunas de rastreamento de recrutamento em affiliates
ALTER TABLE public.affiliates 
  ADD COLUMN IF NOT EXISTS source_manager_affiliate_id uuid,
  ADD COLUMN IF NOT EXISTS recruited_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_affiliates_source_manager 
  ON public.affiliates(source_manager_affiliate_id) 
  WHERE source_manager_affiliate_id IS NOT NULL;

-- 2. Atualizar default e validar status de affiliate_managers (active|paused|blocked|pending)
ALTER TABLE public.affiliate_managers
  DROP CONSTRAINT IF EXISTS affiliate_managers_status_check;

ALTER TABLE public.affiliate_managers
  ADD CONSTRAINT affiliate_managers_status_check 
  CHECK (status IN ('active', 'paused', 'blocked', 'pending'));

-- 3. Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS public.affiliate_manager_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_affiliate_id uuid NOT NULL,
  influencer_affiliate_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('linked', 'unlinked', 'status_changed', 'override_changed')),
  performed_by uuid NOT NULL,
  old_value jsonb,
  new_value jsonb,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

ALTER TABLE public.affiliate_manager_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all audit" ON public.affiliate_manager_audit
  FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "Manager views own audit" ON public.affiliate_manager_audit
  FOR SELECT USING (
    manager_affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated can insert audit" ON public.affiliate_manager_audit
  FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid());

CREATE INDEX idx_affiliate_manager_audit_manager ON public.affiliate_manager_audit(manager_affiliate_id, created_at DESC);
CREATE INDEX idx_affiliate_manager_audit_influencer ON public.affiliate_manager_audit(influencer_affiliate_id, created_at DESC);

-- 4. Função RPC: métricas de funil por influencer de um manager
CREATE OR REPLACE FUNCTION public.get_manager_influencer_metrics(p_manager_affiliate_id uuid)
RETURNS TABLE (
  link_id uuid,
  influencer_affiliate_id uuid,
  influencer_user_id uuid,
  affiliate_code text,
  full_name text,
  email text,
  status text,
  override_rate numeric,
  recruited_at timestamp with time zone,
  total_clicks bigint,
  total_signups bigint,
  unique_buyers bigint,
  conversion_rate numeric,
  total_sales numeric,
  total_commission numeric,
  total_override numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_affiliate_id uuid;
BEGIN
  -- Verifica se quem chama é o próprio manager (ou admin)
  SELECT id INTO v_caller_affiliate_id 
  FROM public.affiliates 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  IF v_caller_affiliate_id IS NULL OR (v_caller_affiliate_id <> p_manager_affiliate_id AND NOT is_admin_user(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT 
    am.id AS link_id,
    am.influencer_affiliate_id,
    a.user_id AS influencer_user_id,
    a.affiliate_code,
    COALESCE(p.full_name, 'Sem nome') AS full_name,
    COALESCE(p.email, '') AS email,
    am.status,
    am.override_rate,
    a.recruited_at,
    COALESCE((SELECT COUNT(*) FROM public.affiliate_referrals ar 
              WHERE ar.affiliate_id = am.influencer_affiliate_id), 0) AS total_clicks,
    COALESCE((SELECT COUNT(*) FROM public.affiliate_referrals ar 
              WHERE ar.affiliate_id = am.influencer_affiliate_id AND ar.referred_user_id IS NOT NULL), 0) AS total_signups,
    COALESCE((SELECT COUNT(DISTINCT ac.referred_user_id) FROM public.affiliate_commissions ac 
              WHERE ac.affiliate_id = am.influencer_affiliate_id), 0) AS unique_buyers,
    CASE 
      WHEN COALESCE((SELECT COUNT(*) FROM public.affiliate_referrals ar 
                     WHERE ar.affiliate_id = am.influencer_affiliate_id), 0) = 0 THEN 0
      ELSE ROUND(
        (COALESCE((SELECT COUNT(DISTINCT ac.referred_user_id) FROM public.affiliate_commissions ac 
                   WHERE ac.affiliate_id = am.influencer_affiliate_id), 0)::numeric * 100.0) /
        NULLIF((SELECT COUNT(*) FROM public.affiliate_referrals ar 
                WHERE ar.affiliate_id = am.influencer_affiliate_id), 0), 2)
    END AS conversion_rate,
    COALESCE((SELECT SUM(ac.purchase_amount) FROM public.affiliate_commissions ac 
              WHERE ac.affiliate_id = am.influencer_affiliate_id), 0) AS total_sales,
    COALESCE((SELECT SUM(ac.commission_amount) FROM public.affiliate_commissions ac 
              WHERE ac.affiliate_id = am.influencer_affiliate_id), 0) AS total_commission,
    COALESCE((SELECT SUM(ac.commission_amount) FROM public.affiliate_commissions ac 
              WHERE ac.affiliate_id = p_manager_affiliate_id 
                AND ac.referred_user_id IN (
                  SELECT DISTINCT ac2.referred_user_id 
                  FROM public.affiliate_commissions ac2 
                  WHERE ac2.affiliate_id = am.influencer_affiliate_id
                )), 0) AS total_override
  FROM public.affiliate_managers am
  JOIN public.affiliates a ON a.id = am.influencer_affiliate_id
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE am.manager_affiliate_id = p_manager_affiliate_id
  ORDER BY am.created_at DESC;
END;
$$;

-- 5. Ajustar trigger de override para respeitar status do vínculo
CREATE OR REPLACE FUNCTION public.generate_override_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_link RECORD;
  v_override_amount numeric;
BEGIN
  -- Busca vínculo de manager APENAS se estiver active
  SELECT am.manager_affiliate_id, am.override_rate
  INTO v_manager_link
  FROM public.affiliate_managers am
  WHERE am.influencer_affiliate_id = NEW.affiliate_id
    AND am.status = 'active'
  LIMIT 1;

  IF v_manager_link IS NULL THEN
    RETURN NEW;
  END IF;

  -- Não gerar override sobre comissão do próprio manager
  IF v_manager_link.manager_affiliate_id = NEW.affiliate_id THEN
    RETURN NEW;
  END IF;

  v_override_amount := ROUND((NEW.purchase_amount * v_manager_link.override_rate / 100.0)::numeric, 2);

  IF v_override_amount > 0 THEN
    INSERT INTO public.affiliate_commissions (
      affiliate_id,
      purchase_id,
      referred_user_id,
      purchase_amount,
      commission_rate,
      commission_amount,
      status,
      is_repurchase
    ) VALUES (
      v_manager_link.manager_affiliate_id,
      NEW.purchase_id,
      NEW.referred_user_id,
      NEW.purchase_amount,
      v_manager_link.override_rate,
      v_override_amount,
      'pending',
      NEW.is_repurchase
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Garante que o trigger existe (idempotente)
DROP TRIGGER IF EXISTS trg_generate_override_commission ON public.affiliate_commissions;
CREATE TRIGGER trg_generate_override_commission
  AFTER INSERT ON public.affiliate_commissions
  FOR EACH ROW
  WHEN (NEW.affiliate_id IS NOT NULL)
  EXECUTE FUNCTION public.generate_override_commission();