-- Atualizar trigger para usar a função position_partner_binary existente
-- que já implementa spillover E propagação de pontos para toda a árvore
CREATE OR REPLACE FUNCTION public.auto_create_binary_position()
RETURNS TRIGGER AS $$
DECLARE
  v_sponsor_contract_id uuid;
  v_result jsonb;
  v_preferred_side text;
  v_sponsor_left_points integer;
  v_sponsor_right_points integer;
BEGIN
  IF NEW.status = 'ACTIVE' THEN
    -- Verificar se já existe posição
    IF NOT EXISTS (
      SELECT 1 FROM public.partner_binary_positions 
      WHERE partner_contract_id = NEW.id
    ) THEN
      
      -- Buscar contrato ativo do patrocinador se existir
      IF NEW.referred_by_user_id IS NOT NULL THEN
        SELECT id INTO v_sponsor_contract_id
        FROM public.partner_contracts
        WHERE user_id = NEW.referred_by_user_id
          AND status = 'ACTIVE'
        LIMIT 1;
      END IF;
      
      IF v_sponsor_contract_id IS NOT NULL THEN
        -- Verificar se o sponsor tem posição binária
        IF NOT EXISTS (
          SELECT 1 FROM public.partner_binary_positions 
          WHERE partner_contract_id = v_sponsor_contract_id
        ) THEN
          -- Criar posição raiz para o sponsor
          INSERT INTO public.partner_binary_positions (partner_contract_id)
          VALUES (v_sponsor_contract_id);
        END IF;
        
        -- Determinar a perna preferida (menor pontos = perna fraca)
        SELECT COALESCE(left_points, 0), COALESCE(right_points, 0)
        INTO v_sponsor_left_points, v_sponsor_right_points
        FROM public.partner_binary_positions
        WHERE partner_contract_id = v_sponsor_contract_id;
        
        IF v_sponsor_left_points <= v_sponsor_right_points THEN
          v_preferred_side := 'left';
        ELSE
          v_preferred_side := 'right';
        END IF;
        
        -- Usar a função position_partner_binary que já implementa:
        -- 1. Spillover automático quando posição direta ocupada
        -- 2. Propagação de pontos para TODOS os uplines (toda a árvore acima)
        v_result := public.position_partner_binary(
          NEW.id,                    -- p_contract_id
          v_sponsor_contract_id,     -- p_sponsor_contract_id  
          v_preferred_side           -- p_position
        );
        
        -- Log do resultado
        RAISE NOTICE 'Auto-positioned partner %: %', NEW.id, v_result;
        
      ELSE
        -- Sem patrocinador: criar posição raiz
        INSERT INTO public.partner_binary_positions (
          partner_contract_id,
          sponsor_contract_id,
          parent_contract_id,
          position,
          left_points,
          right_points,
          total_left_points,
          total_right_points
        ) VALUES (
          NEW.id, NULL, NULL, NULL, 0, 0, 0, 0
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;