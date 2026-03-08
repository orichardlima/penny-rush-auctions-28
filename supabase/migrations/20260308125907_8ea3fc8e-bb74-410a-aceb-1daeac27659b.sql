
-- Vincular Carolina Bastos como indicada do afiliado Paulo Mota (LUISBD98)
INSERT INTO affiliate_referrals (affiliate_id, referred_user_id, converted, click_source)
VALUES ('92e39f3b-4ea7-4b9d-a193-5ab981b4112a', '27057919-a547-486b-8903-f6ad2bbdd022', true, 'manual_admin_link');

-- Atualizar contadores do afiliado
UPDATE affiliates
SET total_referrals = total_referrals + 1,
    total_conversions = total_conversions + 1
WHERE id = '92e39f3b-4ea7-4b9d-a193-5ab981b4112a';
