
-- Remover constraint antigo que não inclui source_event
ALTER TABLE public.partner_referral_bonuses
DROP CONSTRAINT partner_referral_bonuses_referred_contract_level_key;

-- Restaurar bônus de ativação aos valores originais Legend
UPDATE public.partner_referral_bonuses SET aporte_value = 9999, bonus_value = 1199.88 WHERE id = 'fe6a608a-5452-4421-92d6-119c504c6147';
UPDATE public.partner_referral_bonuses SET aporte_value = 9999, bonus_value = 199.98 WHERE id = '72deac19-c58e-44cc-837a-92c12d29ddd2';
UPDATE public.partner_referral_bonuses SET aporte_value = 9999, bonus_value = 49.995 WHERE id = '93639569-fb86-42d8-bbe6-08c737500878';

-- Inserir bônus de upgrade nível 1 (Paulo Mota)
INSERT INTO public.partner_referral_bonuses (referrer_contract_id, referred_contract_id, referred_user_id, referral_level, bonus_percentage, aporte_value, bonus_value, status, source_event, is_fast_start_bonus, available_at)
VALUES ('f54fe7ca-bc23-4db8-b4cb-39ead3d4a1e8', 'be3406be-0248-439f-84cb-77a85d344867', 'fadb0e25-821c-4dd5-bb48-32d25efbec14', 1, 12, 15001, 1800.12, 'AVAILABLE', 'upgrade', false, now());

-- Inserir bônus de upgrade nível 2 (Luiz Claudio)
INSERT INTO public.partner_referral_bonuses (referrer_contract_id, referred_contract_id, referred_user_id, referral_level, bonus_percentage, aporte_value, bonus_value, status, source_event, is_fast_start_bonus, available_at)
VALUES ('45044294-06d0-44e1-a0aa-6461f2f0f058', 'be3406be-0248-439f-84cb-77a85d344867', 'fadb0e25-821c-4dd5-bb48-32d25efbec14', 2, 2, 15001, 300.02, 'AVAILABLE', 'upgrade', false, now());

-- Inserir bônus de upgrade nível 3 (Mariano)
INSERT INTO public.partner_referral_bonuses (referrer_contract_id, referred_contract_id, referred_user_id, referral_level, bonus_percentage, aporte_value, bonus_value, status, source_event, is_fast_start_bonus, available_at)
VALUES ('879cbe85-7623-476c-8159-c9fa1eab0791', 'be3406be-0248-439f-84cb-77a85d344867', 'fadb0e25-821c-4dd5-bb48-32d25efbec14', 3, 0.5, 15001, 75.005, 'AVAILABLE', 'upgrade', false, now());
