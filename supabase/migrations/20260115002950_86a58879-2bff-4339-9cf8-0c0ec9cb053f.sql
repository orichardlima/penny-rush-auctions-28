-- Corrigir o bônus criado com valores zerados
-- O plano do indicador (Richard) é START com 10% de bonus
-- O aporte do indicado (PRO) é R$ 1499
-- Bônus = 1499 * 10% = R$ 149.90

UPDATE partner_referral_bonuses
SET bonus_percentage = 10,
    bonus_value = 149.90
WHERE id = '01468877-62e6-4f0e-a2e1-88cb09594993';

-- Também atualizar pontos de indicação do Richard
-- O plano PRO tem seus pontos definidos na tabela partner_level_points
UPDATE partner_contracts
SET total_referral_points = total_referral_points + COALESCE(
  (SELECT points FROM partner_level_points WHERE UPPER(plan_name) = 'PRO'),
  100
)
WHERE id = 'c42ad205-3e35-40ff-a292-c888a6a5011b'
  AND NOT EXISTS (
    -- Só adicionar se ainda não foi adicionado (evitar duplicação)
    SELECT 1 FROM partner_referral_bonuses
    WHERE referrer_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b'
      AND referred_contract_id = '15cd36ba-5342-4714-9597-85a1f68f566f'
      AND referral_level = 1
      AND bonus_value > 0
  );