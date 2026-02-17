
-- Reconectar Administrador como filho esquerdo de Richard
UPDATE partner_binary_positions
SET parent_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b'
WHERE partner_contract_id = '1de6fd0d-030c-4501-b022-dacb8108d869';

-- Reconectar Adailton como filho direito de Richard
UPDATE partner_binary_positions
SET parent_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b'
WHERE partner_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e';

-- Atualizar referencias de filhos em Richard
UPDATE partner_binary_positions
SET left_child_id = '1de6fd0d-030c-4501-b022-dacb8108d869',
    right_child_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e'
WHERE partner_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b';
