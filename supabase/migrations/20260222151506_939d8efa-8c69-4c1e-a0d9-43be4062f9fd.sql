
-- 1. Valentina: remover Lavínia como filha esquerda e zerar left_points
UPDATE partner_binary_positions
SET left_child_id = NULL,
    left_points = 0,
    updated_at = now()
WHERE partner_contract_id = 'efbce3be-0071-49f2-b9ac-fec8e8ecb11e';

-- 2. Luciano: registrar Lavínia como filha direita
UPDATE partner_binary_positions
SET right_child_id = '04ec1858-1e74-424b-8738-c2a18eef53ef',
    updated_at = now()
WHERE partner_contract_id = '60eda7ef-1d6d-4927-9d32-7feadc650bb3';

-- 3. Lavínia: atualizar parent e posição para Luciano/right
UPDATE partner_binary_positions
SET parent_contract_id = '60eda7ef-1d6d-4927-9d32-7feadc650bb3',
    position = 'right',
    updated_at = now()
WHERE partner_contract_id = '04ec1858-1e74-424b-8738-c2a18eef53ef';
