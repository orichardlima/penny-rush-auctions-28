ALTER TABLE partner_contracts DROP CONSTRAINT partner_contracts_status_check;
ALTER TABLE partner_contracts ADD CONSTRAINT partner_contracts_status_check 
  CHECK (status = ANY (ARRAY['ACTIVE', 'CLOSED', 'SUSPENDED', 'PENDING']));