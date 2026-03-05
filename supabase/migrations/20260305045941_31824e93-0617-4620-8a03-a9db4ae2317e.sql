
-- Corrigir pontos fantasmas na perna direita do Mariano
-- right_points: 1000 → 0, total_right_points: 1000 → 0
UPDATE partner_binary_positions
SET right_points = 0,
    total_right_points = 0,
    updated_at = timezone('America/Sao_Paulo', now())
WHERE partner_contract_id = '879cbe85-7623-476c-8159-c9fa1eab0791';
