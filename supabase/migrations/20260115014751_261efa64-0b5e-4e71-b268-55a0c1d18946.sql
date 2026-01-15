-- Função trigger para criar posição binária automaticamente
CREATE OR REPLACE FUNCTION public.auto_create_binary_position()
RETURNS TRIGGER AS $$
BEGIN
  -- Só criar se o contrato está ativo e ainda não tem posição binária
  IF NEW.status = 'ACTIVE' THEN
    -- Verificar se já existe posição para este contrato
    IF NOT EXISTS (
      SELECT 1 FROM public.partner_binary_positions 
      WHERE partner_contract_id = NEW.id
    ) THEN
      -- Inserir posição binária inicial (como raiz, sem patrocinador definido ainda)
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
        NEW.id,
        NULL, -- Será atualizado quando for posicionado na rede
        NULL, -- Será atualizado quando for posicionado na rede
        NULL, -- Será atualizado quando for posicionado na rede
        0,
        0,
        0,
        0
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para novos contratos
DROP TRIGGER IF EXISTS trigger_auto_create_binary_position ON public.partner_contracts;

CREATE TRIGGER trigger_auto_create_binary_position
  AFTER INSERT ON public.partner_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_binary_position();

-- Criar trigger para contratos atualizados (caso mude para ACTIVE)
DROP TRIGGER IF EXISTS trigger_auto_create_binary_position_on_update ON public.partner_contracts;

CREATE TRIGGER trigger_auto_create_binary_position_on_update
  AFTER UPDATE OF status ON public.partner_contracts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ACTIVE')
  EXECUTE FUNCTION public.auto_create_binary_position();

-- Criar posições binárias para contratos ATIVOS existentes que ainda não têm posição
INSERT INTO public.partner_binary_positions (
  partner_contract_id,
  sponsor_contract_id,
  parent_contract_id,
  position,
  left_points,
  right_points,
  total_left_points,
  total_right_points
)
SELECT 
  pc.id,
  NULL,
  NULL,
  NULL,
  0,
  0,
  0,
  0
FROM public.partner_contracts pc
WHERE pc.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM public.partner_binary_positions pbp 
    WHERE pbp.partner_contract_id = pc.id
  );