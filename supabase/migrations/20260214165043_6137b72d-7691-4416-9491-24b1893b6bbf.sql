
-- =============================================
-- FAST START BONUS - Etapa 1: Banco de Dados
-- =============================================

-- 1. Tabela de faixas configuráveis
CREATE TABLE public.fast_start_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  required_referrals integer NOT NULL,
  extra_percentage numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

ALTER TABLE public.fast_start_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fast start tiers"
  ON public.fast_start_tiers FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Authenticated users can view active tiers"
  ON public.fast_start_tiers FOR SELECT
  USING (is_active = true);

-- 2. Tabela de conquistas
CREATE TABLE public.fast_start_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_contract_id uuid NOT NULL REFERENCES public.partner_contracts(id),
  tier_id uuid NOT NULL REFERENCES public.fast_start_tiers(id),
  referrals_count integer NOT NULL,
  extra_percentage_applied numeric NOT NULL,
  total_extra_bonus numeric NOT NULL DEFAULT 0,
  achieved_at timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

ALTER TABLE public.fast_start_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fast start achievements"
  ON public.fast_start_achievements FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view own achievements"
  ON public.fast_start_achievements FOR SELECT
  USING (partner_contract_id IN (
    SELECT id FROM partner_contracts WHERE user_id = auth.uid()
  ));

-- 3. Nova coluna em partner_referral_bonuses
ALTER TABLE public.partner_referral_bonuses
  ADD COLUMN is_fast_start_bonus boolean NOT NULL DEFAULT false;

-- 4. Função para processar o bônus retroativo
CREATE OR REPLACE FUNCTION public.process_fast_start_bonus(
  p_contract_id uuid,
  p_tier_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier RECORD;
  v_contract RECORD;
  v_bonus RECORD;
  v_extra_pct numeric;
  v_extra_value numeric;
  v_total_extra numeric := 0;
  v_referrals_count integer;
  v_window_end timestamptz;
  v_existing_achievement_id uuid;
  v_prev_extra_pct numeric := 0;
BEGIN
  -- Buscar a faixa
  SELECT * INTO v_tier FROM fast_start_tiers WHERE id = p_tier_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Buscar o contrato
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_window_end := v_contract.created_at + interval '30 days';

  -- Verificar se já existe achievement para esta faixa ou superior
  SELECT id INTO v_existing_achievement_id
  FROM fast_start_achievements
  WHERE partner_contract_id = p_contract_id
    AND extra_percentage_applied >= v_tier.extra_percentage
    AND processed = true;

  IF FOUND THEN
    RETURN; -- Já processou faixa igual ou superior
  END IF;

  -- Buscar a maior faixa anterior já processada (para calcular diferença incremental)
  SELECT COALESCE(MAX(extra_percentage_applied), 0) INTO v_prev_extra_pct
  FROM fast_start_achievements
  WHERE partner_contract_id = p_contract_id
    AND processed = true;

  -- Se a nova faixa não é maior que a anterior, sair
  IF v_tier.extra_percentage <= v_prev_extra_pct THEN
    RETURN;
  END IF;

  -- Porcentagem extra incremental (diferença entre nova faixa e anterior)
  v_extra_pct := v_tier.extra_percentage - v_prev_extra_pct;

  -- Contar indicações diretas no período
  SELECT COUNT(*) INTO v_referrals_count
  FROM partner_referral_bonuses
  WHERE referrer_contract_id = p_contract_id
    AND referral_level = 1
    AND status != 'CANCELLED'
    AND is_fast_start_bonus = false
    AND created_at <= v_window_end;

  -- Para cada bônus original de nível 1 no período, criar complemento
  FOR v_bonus IN
    SELECT *
    FROM partner_referral_bonuses
    WHERE referrer_contract_id = p_contract_id
      AND referral_level = 1
      AND status != 'CANCELLED'
      AND is_fast_start_bonus = false
      AND created_at <= v_window_end
  LOOP
    v_extra_value := (v_bonus.aporte_value * v_extra_pct) / 100;

    INSERT INTO partner_referral_bonuses (
      referrer_contract_id,
      referred_contract_id,
      referred_user_id,
      aporte_value,
      bonus_percentage,
      bonus_value,
      referral_level,
      status,
      is_fast_start_bonus
    ) VALUES (
      p_contract_id,
      v_bonus.referred_contract_id,
      v_bonus.referred_user_id,
      v_bonus.aporte_value,
      v_extra_pct,
      v_extra_value,
      1,
      'PENDING',
      true
    );

    v_total_extra := v_total_extra + v_extra_value;
  END LOOP;

  -- Registrar conquista
  INSERT INTO fast_start_achievements (
    partner_contract_id,
    tier_id,
    referrals_count,
    extra_percentage_applied,
    total_extra_bonus,
    processed
  ) VALUES (
    p_contract_id,
    p_tier_id,
    v_referrals_count,
    v_tier.extra_percentage,
    v_total_extra,
    true
  );
END;
$$;

-- 5. Trigger function para verificar elegibilidade automaticamente
CREATE OR REPLACE FUNCTION public.check_fast_start_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_window_end timestamptz;
  v_referrals_count integer;
  v_tier RECORD;
  v_current_max_pct numeric;
BEGIN
  -- Só processar bônus de nível 1 que não são fast start
  IF NEW.referral_level != 1 OR NEW.is_fast_start_bonus = true THEN
    RETURN NEW;
  END IF;

  -- Buscar contrato do indicador
  SELECT * INTO v_contract
  FROM partner_contracts
  WHERE id = NEW.referrer_contract_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Verificar se está dentro da janela de 30 dias
  v_window_end := v_contract.created_at + interval '30 days';
  IF now() > v_window_end THEN
    RETURN NEW;
  END IF;

  -- Contar indicações diretas no período
  SELECT COUNT(*) INTO v_referrals_count
  FROM partner_referral_bonuses
  WHERE referrer_contract_id = NEW.referrer_contract_id
    AND referral_level = 1
    AND status != 'CANCELLED'
    AND is_fast_start_bonus = false
    AND created_at <= v_window_end;

  -- Buscar faixa já atingida mais alta
  SELECT COALESCE(MAX(extra_percentage_applied), 0) INTO v_current_max_pct
  FROM fast_start_achievements
  WHERE partner_contract_id = NEW.referrer_contract_id
    AND processed = true;

  -- Verificar se atingiu uma nova faixa
  FOR v_tier IN
    SELECT * FROM fast_start_tiers
    WHERE is_active = true
      AND required_referrals <= v_referrals_count
      AND extra_percentage > v_current_max_pct
    ORDER BY extra_percentage DESC
    LIMIT 1
  LOOP
    PERFORM process_fast_start_bonus(NEW.referrer_contract_id, v_tier.id);
  END LOOP;

  RETURN NEW;
END;
$$;

-- 6. Criar trigger
CREATE TRIGGER trg_check_fast_start
  AFTER INSERT ON public.partner_referral_bonuses
  FOR EACH ROW
  EXECUTE FUNCTION public.check_fast_start_eligibility();

-- 7. Dados iniciais (faixas padrão)
INSERT INTO public.fast_start_tiers (name, required_referrals, extra_percentage, sort_order) VALUES
  ('Acelerador', 3, 2, 1),
  ('Turbo', 5, 4, 2),
  ('Foguete', 10, 6, 3);
