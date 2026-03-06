
-- Corrigir left_points do Claudio (remover 1000 pontos indevidos do Luis Paulo)
UPDATE partner_binary_positions 
SET left_points = 1000, total_left_points = total_left_points - 1000
WHERE partner_contract_id = '45044294-06d0-44e1-a0aa-6461f2f0f058';

-- Remover o registro indevido do binary_points_log
DELETE FROM binary_points_log 
WHERE id = 'b8fdffe7-af34-4dc8-93bc-89fb9892cec1';
