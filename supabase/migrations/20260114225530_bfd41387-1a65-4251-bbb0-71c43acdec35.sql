-- =====================================================
-- SISTEMA DE COMPENSAÇÃO BINÁRIA (MLM)
-- =====================================================

-- Tabela: Posições na árvore binária
CREATE TABLE public.partner_binary_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id UUID NOT NULL UNIQUE REFERENCES public.partner_contracts(id) ON DELETE CASCADE,
  sponsor_contract_id UUID REFERENCES public.partner_contracts(id), -- Quem indicou (dono do link)
  parent_contract_id UUID REFERENCES public.partner_contracts(id),  -- Pai direto na árvore binária
  position TEXT CHECK (position IN ('left', 'right')), -- Posição sob o pai (null se for raiz)
  left_points INTEGER NOT NULL DEFAULT 0,  -- Pontos acumulados perna esquerda
  right_points INTEGER NOT NULL DEFAULT 0, -- Pontos acumulados perna direita
  total_left_points INTEGER NOT NULL DEFAULT 0,  -- Histórico total esquerda
  total_right_points INTEGER NOT NULL DEFAULT 0, -- Histórico total direita
  left_child_id UUID REFERENCES public.partner_contracts(id), -- Filho direto esquerda
  right_child_id UUID REFERENCES public.partner_contracts(id), -- Filho direto direita
  pending_position_for UUID REFERENCES public.partner_contracts(id), -- Contrato aguardando posicionamento
  pending_position_expires_at TIMESTAMPTZ, -- Quando expira o prazo para posicionar
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Índices para performance
CREATE INDEX idx_binary_positions_sponsor ON public.partner_binary_positions(sponsor_contract_id);
CREATE INDEX idx_binary_positions_parent ON public.partner_binary_positions(parent_contract_id);
CREATE INDEX idx_binary_positions_left_child ON public.partner_binary_positions(left_child_id);
CREATE INDEX idx_binary_positions_right_child ON public.partner_binary_positions(right_child_id);
CREATE INDEX idx_binary_positions_pending ON public.partner_binary_positions(pending_position_for) WHERE pending_position_for IS NOT NULL;

-- Tabela: Fechamentos de ciclo binário
CREATE TABLE public.binary_cycle_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_number INTEGER NOT NULL,
  closed_by UUID NOT NULL,
  bonus_percentage NUMERIC NOT NULL,
  point_value NUMERIC NOT NULL DEFAULT 1.00, -- Valor em R$ de cada ponto
  total_points_matched INTEGER NOT NULL DEFAULT 0,
  total_bonus_distributed NUMERIC NOT NULL DEFAULT 0,
  partners_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  UNIQUE(cycle_number)
);

-- Índice para buscar ciclos por data
CREATE INDEX idx_binary_cycles_created ON public.binary_cycle_closures(created_at DESC);

-- Tabela: Bônus binários gerados em cada fechamento
CREATE TABLE public.binary_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_closure_id UUID NOT NULL REFERENCES public.binary_cycle_closures(id) ON DELETE CASCADE,
  partner_contract_id UUID NOT NULL REFERENCES public.partner_contracts(id),
  left_points_before INTEGER NOT NULL,
  right_points_before INTEGER NOT NULL,
  matched_points INTEGER NOT NULL, -- Pontos pareados (menor perna)
  bonus_percentage NUMERIC NOT NULL,
  point_value NUMERIC NOT NULL,
  bonus_value NUMERIC NOT NULL,
  left_points_remaining INTEGER NOT NULL, -- Sobra da perna esquerda
  right_points_remaining INTEGER NOT NULL, -- Sobra da perna direita
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AVAILABLE', 'PAID', 'CANCELLED')),
  available_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Índices para bônus
CREATE INDEX idx_binary_bonuses_cycle ON public.binary_bonuses(cycle_closure_id);
CREATE INDEX idx_binary_bonuses_partner ON public.binary_bonuses(partner_contract_id);
CREATE INDEX idx_binary_bonuses_status ON public.binary_bonuses(status);

-- Tabela: Log de propagação de pontos (auditoria)
CREATE TABLE public.binary_points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id UUID NOT NULL REFERENCES public.partner_contracts(id),
  source_contract_id UUID NOT NULL REFERENCES public.partner_contracts(id), -- De quem vieram os pontos
  points_added INTEGER NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('left', 'right')),
  reason TEXT NOT NULL, -- 'new_partner', 'upgrade', 'manual_adjustment'
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

CREATE INDEX idx_binary_points_log_partner ON public.binary_points_log(partner_contract_id);
CREATE INDEX idx_binary_points_log_source ON public.binary_points_log(source_contract_id);

-- =====================================================
-- CONFIGURAÇÕES DO SISTEMA BINÁRIO
-- =====================================================

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('binary_bonus_percentage', '10', 'number', 'Porcentagem do bônus sobre pontos pareados da menor perna'),
  ('binary_point_value', '1', 'number', 'Valor em reais de cada ponto do binário'),
  ('binary_positioning_timeout_hours', '24', 'number', 'Horas para o indicador posicionar antes do auto-spillover'),
  ('binary_system_enabled', 'true', 'boolean', 'Sistema binário habilitado');

-- =====================================================
-- FUNÇÃO: Propagar pontos na árvore binária
-- =====================================================

CREATE OR REPLACE FUNCTION public.propagate_binary_points(
  p_source_contract_id UUID,
  p_points INTEGER,
  p_reason TEXT DEFAULT 'new_partner'
)
RETURNS INTEGER AS $$
DECLARE
  v_current_id UUID;
  v_parent_id UUID;
  v_position TEXT;
  v_propagation_count INTEGER := 0;
BEGIN
  -- Encontrar a posição do contrato fonte
  SELECT parent_contract_id, position INTO v_parent_id, v_position
  FROM public.partner_binary_positions 
  WHERE partner_contract_id = p_source_contract_id;
  
  -- Se não tem pai, não há o que propagar
  IF v_parent_id IS NULL THEN
    RETURN 0;
  END IF;
  
  v_current_id := p_source_contract_id;
  
  -- Subir na árvore propagando pontos
  WHILE v_parent_id IS NOT NULL LOOP
    -- Atualizar pontos do pai baseado na posição do filho
    IF v_position = 'left' THEN
      UPDATE public.partner_binary_positions 
      SET left_points = left_points + p_points,
          total_left_points = total_left_points + p_points,
          updated_at = timezone('America/Sao_Paulo', now())
      WHERE partner_contract_id = v_parent_id;
    ELSE
      UPDATE public.partner_binary_positions 
      SET right_points = right_points + p_points,
          total_right_points = total_right_points + p_points,
          updated_at = timezone('America/Sao_Paulo', now())
      WHERE partner_contract_id = v_parent_id;
    END IF;
    
    -- Registrar no log
    INSERT INTO public.binary_points_log (partner_contract_id, source_contract_id, points_added, position, reason)
    VALUES (v_parent_id, p_source_contract_id, p_points, v_position, p_reason);
    
    v_propagation_count := v_propagation_count + 1;
    
    -- Mover para o próximo nível
    v_current_id := v_parent_id;
    
    SELECT parent_contract_id, position INTO v_parent_id, v_position
    FROM public.partner_binary_positions 
    WHERE partner_contract_id = v_current_id;
  END LOOP;
  
  RETURN v_propagation_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO: Posicionar parceiro na árvore binária
-- =====================================================

CREATE OR REPLACE FUNCTION public.position_partner_binary(
  p_contract_id UUID,
  p_sponsor_contract_id UUID,
  p_position TEXT -- 'left' ou 'right'
)
RETURNS JSONB AS $$
DECLARE
  v_parent_id UUID;
  v_current_id UUID;
  v_points INTEGER;
  v_plan_name TEXT;
  v_existing_child UUID;
BEGIN
  -- Validar posição
  IF p_position NOT IN ('left', 'right') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posição inválida. Use left ou right.');
  END IF;
  
  -- Verificar se já existe posição
  IF EXISTS (SELECT 1 FROM public.partner_binary_positions WHERE partner_contract_id = p_contract_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parceiro já está posicionado na árvore.');
  END IF;
  
  -- Verificar se o sponsor tem posição
  IF NOT EXISTS (SELECT 1 FROM public.partner_binary_positions WHERE partner_contract_id = p_sponsor_contract_id) THEN
    -- Criar posição para o sponsor como raiz
    INSERT INTO public.partner_binary_positions (partner_contract_id)
    VALUES (p_sponsor_contract_id);
  END IF;
  
  -- Verificar se a posição direta no sponsor está disponível
  IF p_position = 'left' THEN
    SELECT left_child_id INTO v_existing_child
    FROM public.partner_binary_positions WHERE partner_contract_id = p_sponsor_contract_id;
  ELSE
    SELECT right_child_id INTO v_existing_child
    FROM public.partner_binary_positions WHERE partner_contract_id = p_sponsor_contract_id;
  END IF;
  
  IF v_existing_child IS NULL THEN
    -- Posição direta disponível, posicionar aqui
    v_parent_id := p_sponsor_contract_id;
  ELSE
    -- Posição ocupada, fazer spillover (encontrar primeira posição livre descendo)
    v_current_id := v_existing_child;
    
    LOOP
      -- Verificar se tem posição livre na esquerda primeiro
      SELECT left_child_id INTO v_existing_child
      FROM public.partner_binary_positions WHERE partner_contract_id = v_current_id;
      
      IF v_existing_child IS NULL THEN
        v_parent_id := v_current_id;
        p_position := 'left';
        EXIT;
      END IF;
      
      -- Verificar direita
      SELECT right_child_id INTO v_existing_child
      FROM public.partner_binary_positions WHERE partner_contract_id = v_current_id;
      
      IF v_existing_child IS NULL THEN
        v_parent_id := v_current_id;
        p_position := 'right';
        EXIT;
      END IF;
      
      -- Ambos ocupados, descer pela esquerda (spillover)
      SELECT left_child_id INTO v_current_id
      FROM public.partner_binary_positions WHERE partner_contract_id = v_current_id;
    END LOOP;
  END IF;
  
  -- Criar posição para o novo parceiro
  INSERT INTO public.partner_binary_positions (
    partner_contract_id,
    sponsor_contract_id,
    parent_contract_id,
    position
  ) VALUES (
    p_contract_id,
    p_sponsor_contract_id,
    v_parent_id,
    p_position
  );
  
  -- Atualizar referência de filho no pai
  IF p_position = 'left' THEN
    UPDATE public.partner_binary_positions 
    SET left_child_id = p_contract_id, updated_at = timezone('America/Sao_Paulo', now())
    WHERE partner_contract_id = v_parent_id;
  ELSE
    UPDATE public.partner_binary_positions 
    SET right_child_id = p_contract_id, updated_at = timezone('America/Sao_Paulo', now())
    WHERE partner_contract_id = v_parent_id;
  END IF;
  
  -- Limpar pendência se existir
  UPDATE public.partner_binary_positions
  SET pending_position_for = NULL, pending_position_expires_at = NULL
  WHERE partner_contract_id = p_sponsor_contract_id AND pending_position_for = p_contract_id;
  
  -- Buscar pontos do plano
  SELECT plan_name INTO v_plan_name FROM public.partner_contracts WHERE id = p_contract_id;
  
  SELECT COALESCE(points, 0) INTO v_points 
  FROM public.partner_level_points 
  WHERE UPPER(plan_name) = UPPER(v_plan_name);
  
  IF v_points IS NULL THEN v_points := 0; END IF;
  
  -- Propagar pontos para uplines
  IF v_points > 0 THEN
    PERFORM public.propagate_binary_points(p_contract_id, v_points, 'new_partner');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'parent_contract_id', v_parent_id,
    'position', p_position,
    'points_propagated', v_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO: Processar fechamento de ciclo binário
-- =====================================================

CREATE OR REPLACE FUNCTION public.close_binary_cycle(
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cycle_id UUID;
  v_cycle_number INTEGER;
  v_bonus_percentage NUMERIC;
  v_point_value NUMERIC;
  v_total_matched INTEGER := 0;
  v_total_bonus NUMERIC := 0;
  v_partners_count INTEGER := 0;
  v_partner RECORD;
  v_matched INTEGER;
  v_bonus NUMERIC;
  v_left_remaining INTEGER;
  v_right_remaining INTEGER;
BEGIN
  -- Buscar configurações
  SELECT COALESCE(setting_value::NUMERIC, 10) INTO v_bonus_percentage
  FROM public.system_settings WHERE setting_key = 'binary_bonus_percentage';
  
  SELECT COALESCE(setting_value::NUMERIC, 1) INTO v_point_value
  FROM public.system_settings WHERE setting_key = 'binary_point_value';
  
  -- Determinar número do ciclo
  SELECT COALESCE(MAX(cycle_number), 0) + 1 INTO v_cycle_number
  FROM public.binary_cycle_closures;
  
  -- Criar registro do ciclo
  INSERT INTO public.binary_cycle_closures (cycle_number, closed_by, bonus_percentage, point_value, notes)
  VALUES (v_cycle_number, p_admin_id, v_bonus_percentage, v_point_value, p_notes)
  RETURNING id INTO v_cycle_id;
  
  -- Processar cada parceiro com pontos
  FOR v_partner IN
    SELECT partner_contract_id, left_points, right_points
    FROM public.partner_binary_positions
    WHERE left_points > 0 OR right_points > 0
  LOOP
    -- Calcular pontos pareados (menor perna)
    v_matched := LEAST(v_partner.left_points, v_partner.right_points);
    
    IF v_matched > 0 THEN
      -- Calcular bônus
      v_bonus := v_matched * v_point_value * (v_bonus_percentage / 100);
      
      -- Calcular sobras
      v_left_remaining := v_partner.left_points - v_matched;
      v_right_remaining := v_partner.right_points - v_matched;
      
      -- Inserir registro do bônus
      INSERT INTO public.binary_bonuses (
        cycle_closure_id,
        partner_contract_id,
        left_points_before,
        right_points_before,
        matched_points,
        bonus_percentage,
        point_value,
        bonus_value,
        left_points_remaining,
        right_points_remaining,
        status,
        available_at
      ) VALUES (
        v_cycle_id,
        v_partner.partner_contract_id,
        v_partner.left_points,
        v_partner.right_points,
        v_matched,
        v_bonus_percentage,
        v_point_value,
        v_bonus,
        v_left_remaining,
        v_right_remaining,
        'AVAILABLE',
        timezone('America/Sao_Paulo', now())
      );
      
      -- Atualizar pontos do parceiro (zerar menor, manter sobra na maior)
      UPDATE public.partner_binary_positions
      SET left_points = v_left_remaining,
          right_points = v_right_remaining,
          updated_at = timezone('America/Sao_Paulo', now())
      WHERE partner_contract_id = v_partner.partner_contract_id;
      
      -- Adicionar ao saldo disponível do contrato
      UPDATE public.partner_contracts
      SET available_balance = available_balance + v_bonus,
          updated_at = timezone('America/Sao_Paulo', now())
      WHERE id = v_partner.partner_contract_id;
      
      -- Atualizar totais
      v_total_matched := v_total_matched + v_matched;
      v_total_bonus := v_total_bonus + v_bonus;
      v_partners_count := v_partners_count + 1;
    END IF;
  END LOOP;
  
  -- Atualizar registro do ciclo com totais
  UPDATE public.binary_cycle_closures
  SET total_points_matched = v_total_matched,
      total_bonus_distributed = v_total_bonus,
      partners_count = v_partners_count
  WHERE id = v_cycle_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'cycle_id', v_cycle_id,
    'cycle_number', v_cycle_number,
    'partners_count', v_partners_count,
    'total_points_matched', v_total_matched,
    'total_bonus_distributed', v_total_bonus,
    'bonus_percentage', v_bonus_percentage,
    'point_value', v_point_value
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO: Preview do fechamento de ciclo
-- =====================================================

CREATE OR REPLACE FUNCTION public.preview_binary_cycle_closure()
RETURNS JSONB AS $$
DECLARE
  v_bonus_percentage NUMERIC;
  v_point_value NUMERIC;
  v_total_matched INTEGER := 0;
  v_total_bonus NUMERIC := 0;
  v_partners_count INTEGER := 0;
  v_preview JSONB := '[]'::JSONB;
  v_partner RECORD;
  v_matched INTEGER;
  v_bonus NUMERIC;
BEGIN
  -- Buscar configurações
  SELECT COALESCE(setting_value::NUMERIC, 10) INTO v_bonus_percentage
  FROM public.system_settings WHERE setting_key = 'binary_bonus_percentage';
  
  SELECT COALESCE(setting_value::NUMERIC, 1) INTO v_point_value
  FROM public.system_settings WHERE setting_key = 'binary_point_value';
  
  -- Calcular preview para cada parceiro
  FOR v_partner IN
    SELECT 
      bp.partner_contract_id, 
      bp.left_points, 
      bp.right_points,
      p.full_name,
      pc.plan_name
    FROM public.partner_binary_positions bp
    JOIN public.partner_contracts pc ON pc.id = bp.partner_contract_id
    JOIN public.profiles p ON p.user_id = pc.user_id
    WHERE bp.left_points > 0 OR bp.right_points > 0
    ORDER BY LEAST(bp.left_points, bp.right_points) DESC
  LOOP
    v_matched := LEAST(v_partner.left_points, v_partner.right_points);
    
    IF v_matched > 0 THEN
      v_bonus := v_matched * v_point_value * (v_bonus_percentage / 100);
      
      v_preview := v_preview || jsonb_build_object(
        'partner_contract_id', v_partner.partner_contract_id,
        'partner_name', v_partner.full_name,
        'plan_name', v_partner.plan_name,
        'left_points', v_partner.left_points,
        'right_points', v_partner.right_points,
        'matched_points', v_matched,
        'bonus_value', v_bonus,
        'left_remaining', v_partner.left_points - v_matched,
        'right_remaining', v_partner.right_points - v_matched
      );
      
      v_total_matched := v_total_matched + v_matched;
      v_total_bonus := v_total_bonus + v_bonus;
      v_partners_count := v_partners_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'bonus_percentage', v_bonus_percentage,
    'point_value', v_point_value,
    'partners_count', v_partners_count,
    'total_points_matched', v_total_matched,
    'total_bonus_to_distribute', v_total_bonus,
    'partners', v_preview
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO: Buscar árvore binária de um parceiro
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_binary_tree(
  p_contract_id UUID,
  p_depth INTEGER DEFAULT 3
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH RECURSIVE tree AS (
    -- Nó raiz
    SELECT 
      bp.partner_contract_id,
      bp.parent_contract_id,
      bp.position,
      bp.left_points,
      bp.right_points,
      bp.left_child_id,
      bp.right_child_id,
      p.full_name,
      pc.plan_name,
      0 AS depth
    FROM public.partner_binary_positions bp
    JOIN public.partner_contracts pc ON pc.id = bp.partner_contract_id
    JOIN public.profiles p ON p.user_id = pc.user_id
    WHERE bp.partner_contract_id = p_contract_id
    
    UNION ALL
    
    -- Filhos
    SELECT 
      bp.partner_contract_id,
      bp.parent_contract_id,
      bp.position,
      bp.left_points,
      bp.right_points,
      bp.left_child_id,
      bp.right_child_id,
      p.full_name,
      pc.plan_name,
      t.depth + 1
    FROM public.partner_binary_positions bp
    JOIN public.partner_contracts pc ON pc.id = bp.partner_contract_id
    JOIN public.profiles p ON p.user_id = pc.user_id
    JOIN tree t ON bp.partner_contract_id = t.left_child_id OR bp.partner_contract_id = t.right_child_id
    WHERE t.depth < p_depth
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'contract_id', partner_contract_id,
      'parent_contract_id', parent_contract_id,
      'position', position,
      'left_points', left_points,
      'right_points', right_points,
      'left_child_id', left_child_id,
      'right_child_id', right_child_id,
      'partner_name', full_name,
      'plan_name', plan_name,
      'depth', depth
    )
  ) INTO v_result
  FROM tree;
  
  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.partner_binary_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.binary_cycle_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.binary_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.binary_points_log ENABLE ROW LEVEL SECURITY;

-- Políticas para partner_binary_positions
CREATE POLICY "Admins can manage all binary positions" ON public.partner_binary_positions
  FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view their own binary position" ON public.partner_binary_positions
  FOR SELECT USING (
    partner_contract_id IN (
      SELECT id FROM public.partner_contracts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their downline binary positions" ON public.partner_binary_positions
  FOR SELECT USING (
    sponsor_contract_id IN (
      SELECT id FROM public.partner_contracts WHERE user_id = auth.uid()
    )
  );

-- Políticas para binary_cycle_closures
CREATE POLICY "Admins can manage binary cycles" ON public.binary_cycle_closures
  FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "Anyone can view binary cycles" ON public.binary_cycle_closures
  FOR SELECT USING (true);

-- Políticas para binary_bonuses
CREATE POLICY "Admins can manage all binary bonuses" ON public.binary_bonuses
  FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view their own binary bonuses" ON public.binary_bonuses
  FOR SELECT USING (
    partner_contract_id IN (
      SELECT id FROM public.partner_contracts WHERE user_id = auth.uid()
    )
  );

-- Políticas para binary_points_log
CREATE POLICY "Admins can view all points log" ON public.binary_points_log
  FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view their own points log" ON public.binary_points_log
  FOR SELECT USING (
    partner_contract_id IN (
      SELECT id FROM public.partner_contracts WHERE user_id = auth.uid()
    )
  );