-- Adicionar campo de bônus de lances nos planos de parceiro
ALTER TABLE partner_plans 
ADD COLUMN bonus_bids INTEGER DEFAULT 0;

-- Adicionar registro do bônus recebido no contrato do parceiro
ALTER TABLE partner_contracts 
ADD COLUMN bonus_bids_received INTEGER DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN partner_plans.bonus_bids IS 'Quantidade de lances de bônus creditados ao adquirir o plano';
COMMENT ON COLUMN partner_contracts.bonus_bids_received IS 'Quantidade de lances de bônus que o parceiro recebeu ao contratar';