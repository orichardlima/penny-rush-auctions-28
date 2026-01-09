-- 1. Atualizar ROI progressivo: total_cap dos planos
UPDATE partner_plans SET total_cap = 5000 WHERE name = 'start';
UPDATE partner_plans SET total_cap = 12500 WHERE name = 'pro';
UPDATE partner_plans SET total_cap = 45000 WHERE name = 'elite';

-- 2. Adicionar campo de bônus de indicação progressivo
ALTER TABLE partner_plans ADD COLUMN IF NOT EXISTS referral_bonus_percentage numeric DEFAULT 10;

-- 3. Definir bônus por plano
UPDATE partner_plans SET referral_bonus_percentage = 10 WHERE name = 'start';
UPDATE partner_plans SET referral_bonus_percentage = 15 WHERE name = 'pro';
UPDATE partner_plans SET referral_bonus_percentage = 20 WHERE name = 'elite';