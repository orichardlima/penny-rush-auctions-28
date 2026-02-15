
-- UPDATE 1: Remove Luciano from Binario 9
UPDATE partner_binary_positions SET left_child_id = NULL, updated_at = now() WHERE partner_contract_id = 'a797b7e7-62a1-4a88-873f-9ad30246f6c8';

-- UPDATE 2: Reposition Luciano (parent, sponsor, position)
UPDATE partner_binary_positions SET parent_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e', sponsor_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e', position = 'right', updated_at = now() WHERE partner_contract_id = '60eda7ef-1d6d-4927-9d32-7feadc650bb3';

-- UPDATE 3: Register Luciano as Adailton's right child
UPDATE partner_binary_positions SET right_child_id = '60eda7ef-1d6d-4927-9d32-7feadc650bb3', updated_at = now() WHERE partner_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e';
