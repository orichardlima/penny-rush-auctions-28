
-- 1. Remover Cláudio do pai atual (Lavínia)
UPDATE partner_binary_positions 
SET right_child_id = NULL, updated_at = NOW()
WHERE partner_contract_id = '04ec1858-1e74-424b-8738-c2a18eef53ef';

-- 2. Atualizar posição binária do Cláudio → Mariano
UPDATE partner_binary_positions 
SET parent_contract_id = '879cbe85-7623-476c-8159-c9fa1eab0791',
    sponsor_contract_id = '879cbe85-7623-476c-8159-c9fa1eab0791',
    position = 'right',
    updated_at = NOW()
WHERE partner_contract_id = '45044294-06d0-44e1-a0aa-6461f2f0f058';

-- 3. Vincular Cláudio como filho direito do Mariano
UPDATE partner_binary_positions 
SET right_child_id = '45044294-06d0-44e1-a0aa-6461f2f0f058', updated_at = NOW()
WHERE partner_contract_id = '879cbe85-7623-476c-8159-c9fa1eab0791';

-- 4. Atualizar referred_by no contrato
UPDATE partner_contracts 
SET referred_by_user_id = '14ddc8ca-f29c-4027-a322-cc38f6ae771b', updated_at = NOW()
WHERE id = '45044294-06d0-44e1-a0aa-6461f2f0f058';

-- 5. Subtrair 1000 pontos do upline antigo (right)
UPDATE partner_binary_positions SET right_points = right_points - 1000, total_right_points = total_right_points - 1000, updated_at = NOW() WHERE partner_contract_id = '04ec1858-1e74-424b-8738-c2a18eef53ef';
UPDATE partner_binary_positions SET right_points = right_points - 1000, total_right_points = total_right_points - 1000, updated_at = NOW() WHERE partner_contract_id = '60eda7ef-1d6d-4927-9d32-7feadc650bb3';
UPDATE partner_binary_positions SET right_points = right_points - 1000, total_right_points = total_right_points - 1000, updated_at = NOW() WHERE partner_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e';
UPDATE partner_binary_positions SET right_points = right_points - 1000, total_right_points = total_right_points - 1000, updated_at = NOW() WHERE partner_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b';

-- 6. Adicionar 1000 pontos no novo upline
UPDATE partner_binary_positions SET right_points = right_points + 1000, total_right_points = total_right_points + 1000, updated_at = NOW() WHERE partner_contract_id = '879cbe85-7623-476c-8159-c9fa1eab0791';
UPDATE partner_binary_positions SET left_points = left_points + 1000, total_left_points = total_left_points + 1000, updated_at = NOW() WHERE partner_contract_id = 'ac002c4c-ace3-40ec-ae3b-71163418a83a';
UPDATE partner_binary_positions SET left_points = left_points + 1000, total_left_points = total_left_points + 1000, updated_at = NOW() WHERE partner_contract_id = '3f4a22b5-43fc-4ad9-8937-d59ecc9f8599';
UPDATE partner_binary_positions SET left_points = left_points + 1000, total_left_points = total_left_points + 1000, updated_at = NOW() WHERE partner_contract_id = '1de6fd0d-030c-4501-b022-dacb8108d869';
UPDATE partner_binary_positions SET left_points = left_points + 1000, total_left_points = total_left_points + 1000, updated_at = NOW() WHERE partner_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b';

-- 7. Audit log (usando admin válido)
INSERT INTO admin_audit_log (admin_user_id, admin_name, action_type, target_type, target_id, description, old_values, new_values)
VALUES (
  'c793d66c-06c5-4fdf-9c2c-0baedd2694f6',
  'Administrador',
  'binary_node_repositioned',
  'partner_contract',
  '45044294-06d0-44e1-a0aa-6461f2f0f058',
  'Cláudio realocado: Lavínia(right) → Mariano(right). Sponsor e referred_by atualizados para Mariano. Pontos corrigidos manualmente.',
  '{"parent": "Lavínia (04ec1858)", "sponsor": "Richard (c42ad205)", "position": "right"}'::jsonb,
  '{"parent": "Mariano (879cbe85)", "sponsor": "Mariano (879cbe85)", "position": "right", "referred_by": "14ddc8ca"}'::jsonb
);
