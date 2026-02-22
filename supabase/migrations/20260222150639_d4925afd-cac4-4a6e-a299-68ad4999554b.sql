
CREATE OR REPLACE FUNCTION public.auto_create_binary_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sponsor_contract_id uuid;
  v_default_sponsor uuid;
  v_result jsonb;
  v_preferred_side text;
  v_sponsor_left_points integer;
  v_sponsor_right_points integer;
  v_sponsor_has_left boolean;
  v_sponsor_has_right boolean;
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
        
        -- Determinar a perna preferida considerando filhos diretos E pontos
        SELECT 
          COALESCE(left_points, 0), 
          COALESCE(right_points, 0),
          (left_child_id IS NOT NULL),
          (right_child_id IS NOT NULL)
        INTO v_sponsor_left_points, v_sponsor_right_points, v_sponsor_has_left, v_sponsor_has_right
        FROM public.partner_binary_positions
        WHERE partner_contract_id = v_sponsor_contract_id;
        
        IF v_sponsor_has_left AND NOT v_sponsor_has_right THEN
          v_preferred_side := 'right';
        ELSIF v_sponsor_has_right AND NOT v_sponsor_has_left THEN
          v_preferred_side := 'left';
        ELSIF v_sponsor_left_points <= v_sponsor_right_points THEN
          v_preferred_side := 'left';
        ELSE
          v_preferred_side := 'right';
        END IF;
        
        -- Usar a função position_partner_binary que já implementa spillover e propagação
        v_result := public.position_partner_binary(
          NEW.id,
          v_sponsor_contract_id,
          v_preferred_side
        );
        
        RAISE NOTICE 'Auto-positioned partner %: %', NEW.id, v_result;
        
      ELSE
        -- Sem patrocinador: buscar nó raiz da árvore como sponsor padrão
        
        -- Primeiro: raiz com filhos (árvore existente)
        SELECT partner_contract_id INTO v_default_sponsor
        FROM public.partner_binary_positions
        WHERE parent_contract_id IS NULL
          AND (left_child_id IS NOT NULL OR right_child_id IS NOT NULL)
        LIMIT 1;
        
        -- Segundo: qualquer raiz (pode ser raiz sem filhos ainda)
        IF v_default_sponsor IS NULL THEN
          SELECT partner_contract_id INTO v_default_sponsor
          FROM public.partner_binary_positions
          WHERE parent_contract_id IS NULL
          LIMIT 1;
        END IF;
        
        IF v_default_sponsor IS NOT NULL THEN
          -- Determinar perna preferida do sponsor padrão considerando filhos diretos E pontos
          SELECT 
            COALESCE(left_points, 0), 
            COALESCE(right_points, 0),
            (left_child_id IS NOT NULL),
            (right_child_id IS NOT NULL)
          INTO v_sponsor_left_points, v_sponsor_right_points, v_sponsor_has_left, v_sponsor_has_right
          FROM public.partner_binary_positions
          WHERE partner_contract_id = v_default_sponsor;
          
          IF v_sponsor_has_left AND NOT v_sponsor_has_right THEN
            v_preferred_side := 'right';
          ELSIF v_sponsor_has_right AND NOT v_sponsor_has_left THEN
            v_preferred_side := 'left';
          ELSIF v_sponsor_left_points <= v_sponsor_right_points THEN
            v_preferred_side := 'left';
          ELSE
            v_preferred_side := 'right';
          END IF;
          
          -- Posicionar automaticamente sob a raiz, com spillover e pontos
          v_result := public.position_partner_binary(
            NEW.id,
            v_default_sponsor,
            v_preferred_side
          );
          
          RAISE NOTICE 'Auto-positioned partner % under default sponsor %: %', NEW.id, v_default_sponsor, v_result;
        ELSE
          -- Rede vazia: este será o primeiro nó raiz
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
  END IF;
  
  RETURN NEW;
END;
$$;
