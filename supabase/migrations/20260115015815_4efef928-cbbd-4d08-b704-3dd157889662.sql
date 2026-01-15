-- 1. Atualizar trigger para auto-posicionar indicados na rede binária
CREATE OR REPLACE FUNCTION public.auto_create_binary_position()
RETURNS TRIGGER AS $$
DECLARE
  v_sponsor_contract_id uuid;
  v_sponsor_position_id uuid;
  v_new_position_id uuid;
  v_available_side text;
  v_points integer;
BEGIN
  IF NEW.status = 'ACTIVE' THEN
    -- Verificar se já existe posição
    IF NOT EXISTS (
      SELECT 1 FROM public.partner_binary_positions 
      WHERE partner_contract_id = NEW.id
    ) THEN
      
      -- Buscar contrato do patrocinador se existir
      IF NEW.referred_by_user_id IS NOT NULL THEN
        SELECT id INTO v_sponsor_contract_id
        FROM public.partner_contracts
        WHERE user_id = NEW.referred_by_user_id
          AND status = 'ACTIVE'
        LIMIT 1;
      END IF;
      
      -- Calcular pontos baseado no plano
      SELECT COALESCE(referral_points_value, 100) INTO v_points
      FROM public.partner_plans
      WHERE name = NEW.plan_name
      LIMIT 1;
      
      IF v_points IS NULL THEN
        v_points := 100;
      END IF;
      
      IF v_sponsor_contract_id IS NOT NULL THEN
        -- Buscar posição do patrocinador e perna disponível
        SELECT id, 
          CASE 
            WHEN left_child_id IS NULL THEN 'left'
            WHEN right_child_id IS NULL THEN 'right'
            ELSE NULL
          END
        INTO v_sponsor_position_id, v_available_side
        FROM public.partner_binary_positions
        WHERE partner_contract_id = v_sponsor_contract_id;
        
        -- Inserir posição com vínculo ao patrocinador
        INSERT INTO public.partner_binary_positions (
          partner_contract_id,
          sponsor_contract_id,
          parent_contract_id,
          position,
          left_points, right_points,
          total_left_points, total_right_points
        ) VALUES (
          NEW.id,
          v_sponsor_contract_id,
          v_sponsor_contract_id,
          v_available_side,
          0, 0, 0, 0
        )
        RETURNING id INTO v_new_position_id;
        
        -- Atualizar filho do patrocinador e adicionar pontos
        IF v_available_side = 'left' THEN
          UPDATE public.partner_binary_positions
          SET left_child_id = NEW.id,
              left_points = left_points + v_points
          WHERE partner_contract_id = v_sponsor_contract_id;
        ELSIF v_available_side = 'right' THEN
          UPDATE public.partner_binary_positions
          SET right_child_id = NEW.id,
              right_points = right_points + v_points
          WHERE partner_contract_id = v_sponsor_contract_id;
        END IF;
      ELSE
        -- Sem patrocinador: posição raiz
        INSERT INTO public.partner_binary_positions (
          partner_contract_id, sponsor_contract_id,
          parent_contract_id, position,
          left_points, right_points,
          total_left_points, total_right_points
        ) VALUES (
          NEW.id, NULL, NULL, NULL, 0, 0, 0, 0
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Corrigir dados existentes do Richard Lima
-- Atualizar a posição do patrocinador com os filhos
UPDATE public.partner_binary_positions
SET 
  left_child_id = '15cd36ba-5342-4714-9597-85a1f68f566f',
  right_child_id = 'd0190e00-f08a-424c-bc89-847d8b230f4e',
  left_points = 150,
  right_points = 150
WHERE partner_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b';

-- Atualizar posição do primeiro indicado (Binario 8) - perna esquerda
UPDATE public.partner_binary_positions
SET 
  sponsor_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b',
  parent_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b',
  position = 'left'
WHERE partner_contract_id = '15cd36ba-5342-4714-9597-85a1f68f566f';

-- Atualizar posição do segundo indicado (Binario 2) - perna direita
UPDATE public.partner_binary_positions
SET 
  sponsor_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b',
  parent_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b',
  position = 'right'
WHERE partner_contract_id = 'd0190e00-f08a-424c-bc89-847d8b230f4e';