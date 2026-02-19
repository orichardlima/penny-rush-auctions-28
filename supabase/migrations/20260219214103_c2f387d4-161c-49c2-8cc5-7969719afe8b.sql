
-- =============================================
-- CORREÇÃO: Reposicionar Ananda na rede do Adailton
-- =============================================

-- PASSO 1: Corrigir referred_by_user_id no contrato ativo da Ananda
UPDATE partner_contracts 
SET referred_by_user_id = 'cb85af36-0756-4ae3-9b58-5efc79ee1087'
WHERE id = '418c750a-cea4-427a-8f19-58fdf87609aa';

-- PASSO 2a: Remover Ananda do pai atual (Administrador)
UPDATE partner_binary_positions 
SET left_child_id = NULL,
    left_points = left_points - 1000,
    total_left_points = total_left_points - 1000,
    updated_at = now()
WHERE partner_contract_id = '1de6fd0d-030c-4501-b022-dacb8108d869'
  AND left_child_id = '418c750a-cea4-427a-8f19-58fdf87609aa';

-- PASSO 2b: Remover pontos indevidos do Richard Lima (left_points tinha 1000 da Ananda via Administrador)
UPDATE partner_binary_positions 
SET left_points = left_points - 1000,
    total_left_points = total_left_points - 1000,
    updated_at = now()
WHERE partner_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b';

-- PASSO 2c: Reposicionar Ananda sob Adailton (perna esquerda)
UPDATE partner_binary_positions 
SET sponsor_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e',
    parent_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e',
    position = 'left',
    updated_at = now()
WHERE partner_contract_id = '418c750a-cea4-427a-8f19-58fdf87609aa';

-- PASSO 2d: Atualizar Adailton para apontar Ananda como left_child
UPDATE partner_binary_positions 
SET left_child_id = '418c750a-cea4-427a-8f19-58fdf87609aa',
    left_points = left_points + 1000,
    total_left_points = total_left_points + 1000,
    updated_at = now()
WHERE partner_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e';

-- PASSO 2e: Propagar pontos para Richard Lima na perna DIREITA (Adailton está na right de Richard)
UPDATE partner_binary_positions 
SET right_points = right_points + 1000,
    total_right_points = total_right_points + 1000,
    updated_at = now()
WHERE partner_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b';

-- PASSO 3: Cancelar contrato duplicado pendente
UPDATE partner_contracts 
SET status = 'CLOSED',
    closed_at = now(),
    closed_reason = 'Contrato duplicado - correcao administrativa'
WHERE id = 'a9b4cf4f-0fa7-4f9c-912a-8df3d7e0ac37'
  AND status = 'PENDING';

-- PASSO 4: Registrar log de pontos para auditoria
INSERT INTO binary_points_log (partner_contract_id, source_contract_id, points_added, position, reason)
VALUES 
  -- Log da remoção de pontos do Administrador
  ('1de6fd0d-030c-4501-b022-dacb8108d869', '418c750a-cea4-427a-8f19-58fdf87609aa', -1000, 'left', 'Correção admin: Ananda removida da rede do Administrador'),
  -- Log da remoção de pontos do Richard (left)
  ('c42ad205-3e35-40ff-a292-c888a6a5011b', '418c750a-cea4-427a-8f19-58fdf87609aa', -1000, 'left', 'Correção admin: pontos indevidos removidos da perna esquerda'),
  -- Log da adição de pontos ao Adailton (left)
  ('9d9db00f-5d02-4e44-8f32-a771220c8b1e', '418c750a-cea4-427a-8f19-58fdf87609aa', 1000, 'left', 'Correção admin: Ananda posicionada na perna esquerda do Adailton'),
  -- Log da adição de pontos ao Richard (right, via Adailton)
  ('c42ad205-3e35-40ff-a292-c888a6a5011b', '418c750a-cea4-427a-8f19-58fdf87609aa', 1000, 'right', 'Correção admin: pontos propagados pela perna direita via Adailton');
