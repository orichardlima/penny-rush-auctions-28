
-- 1. Binario 9: remover 1000 pontos da esquerda
UPDATE partner_binary_positions
SET left_points = 0, total_left_points = 0, updated_at = now()
WHERE partner_contract_id = 'a797b7e7-62a1-4a88-873f-9ad30246f6c8';

-- 2. Binario 8 (ID correto): mover 1000 pts da esquerda para direita
UPDATE partner_binary_positions
SET left_points = 400, right_points = 2000, updated_at = now()
WHERE partner_contract_id = 'd0190e00-f08a-424c-bc89-847d8b230f4e';

-- 3. Adailton: adicionar 1000 pontos na direita
UPDATE partner_binary_positions
SET right_points = 1000, total_right_points = 1000, updated_at = now()
WHERE partner_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e';

-- 4. Log: Adailton recebeu 1000 pts right via Luciano
INSERT INTO binary_points_log (partner_contract_id, source_contract_id, position, points_added, reason)
VALUES ('9d9db00f-5d02-4e44-8f32-a771220c8b1e', '60eda7ef-1d6d-4927-9d32-7feadc650bb3', 'right', 1000, 'Correção manual: propagação de pontos do Luciano Deiro (Legend) pela nova linha ascendente');

-- 5. Log: Binario 8 recebeu 1000 pts right via Luciano (through Adailton)
INSERT INTO binary_points_log (partner_contract_id, source_contract_id, position, points_added, reason)
VALUES ('d0190e00-f08a-424c-bc89-847d8b230f4e', '60eda7ef-1d6d-4927-9d32-7feadc650bb3', 'right', 1000, 'Correção manual: propagação de pontos do Luciano Deiro (Legend) pela nova linha ascendente via Adailton');
