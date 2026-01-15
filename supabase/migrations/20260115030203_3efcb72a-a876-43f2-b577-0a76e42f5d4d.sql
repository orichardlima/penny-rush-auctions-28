-- 1. Remover trigger redundante que causa duplicação de pontos
DROP TRIGGER IF EXISTS on_partner_referral_bonus_created ON public.partner_referral_bonuses;

-- 2. Remover a função que não será mais usada
DROP FUNCTION IF EXISTS public.update_partner_referral_points();

-- 3. Corrigir pontos duplicados em contratos existentes
-- Dividir por 2 todos os contratos que têm pontos > 0
UPDATE public.partner_contracts
SET total_referral_points = total_referral_points / 2,
    updated_at = timezone('America/Sao_Paulo', now())
WHERE total_referral_points > 0;