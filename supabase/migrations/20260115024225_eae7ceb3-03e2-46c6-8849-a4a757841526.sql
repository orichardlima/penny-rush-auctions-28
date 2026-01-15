-- Remover constraint incorreta que impede múltiplos bônus por contrato
ALTER TABLE public.partner_referral_bonuses
DROP CONSTRAINT IF EXISTS partner_referral_bonuses_referred_contract_id_key;

-- Criar constraint correta: combinação de contrato + nível deve ser única
ALTER TABLE public.partner_referral_bonuses
ADD CONSTRAINT partner_referral_bonuses_referred_contract_level_key 
UNIQUE (referred_contract_id, referral_level);