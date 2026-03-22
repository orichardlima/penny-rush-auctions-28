
-- =====================================================
-- Creditar indicações de Luis Paulo Mota (92e39f3b-4ea7-4b9d-a193-5ab981b4112a)
-- para Adriana, Deivide e Meriane
-- =====================================================

-- 1. Marcar 1 compra de cada como completed (Adriana e Deivide)
UPDATE bid_purchases SET payment_status = 'completed' 
WHERE id = 'cffc1160-3948-42fc-8512-513a9744743c' AND payment_status = 'pending';

UPDATE bid_purchases SET payment_status = 'completed' 
WHERE id = '51ce2d60-25b1-4fe3-a3ca-a1f61ac09d45' AND payment_status = 'pending';

-- 2. Criar referral para Meriane (que não tinha registro)
INSERT INTO affiliate_referrals (affiliate_id, referred_user_id, converted, click_source)
VALUES ('92e39f3b-4ea7-4b9d-a193-5ab981b4112a', '56158a8e-29a5-405f-9c18-d10cbcb5db1d', true, 'manual_admin_link');

-- 3. Marcar referrals existentes como convertidos (Adriana e Deivide)
UPDATE affiliate_referrals SET converted = true 
WHERE id = '09d8064c-1f6f-4082-a08b-a1f77a538e2b'; -- Adriana

UPDATE affiliate_referrals SET converted = true 
WHERE id = 'f3fdf476-d820-457e-8dc1-87762c0e54c9'; -- Deivide

-- 4. Criar comissão para Adriana (R$15 × 50% = R$7,50, 1ª compra)
INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, purchase_id, purchase_amount, commission_rate, commission_amount, status, is_repurchase)
VALUES ('92e39f3b-4ea7-4b9d-a193-5ab981b4112a', '264055be-6c15-44c1-967d-4f31bc8ded46', 'cffc1160-3948-42fc-8512-513a9744743c', 15.00, 50, 7.50, 'approved', false);

-- 5. Aprovar comissões pendentes do Deivide (2)
UPDATE affiliate_commissions SET status = 'approved', approved_at = now()
WHERE id IN ('8e71396d-6442-481d-bfae-6086935314ad', '163899cd-0c32-4c55-8f14-88ebe1c6058e');

-- 6. Aprovar comissões pendentes da Meriane (6)
UPDATE affiliate_commissions SET status = 'approved', approved_at = now()
WHERE id IN (
  '4d708eb2-5bed-4e54-9b2d-af3d79076ffd',
  'a6946e87-be00-4d1b-8b0e-60e34f8e5e5d',
  '38e4d4b9-69bc-434c-a929-40d68552cade',
  'a43410a6-e846-46c9-8cc0-722ee4cbf4a8',
  'c1f3e3e9-5687-4226-b5fc-08d51ded5c8b',
  '5d505cb8-4faa-4ff3-a60d-587ec0226873'
);

-- 7. Atualizar métricas do Luis Paulo (+3 referrals convertidos, +2 conversions novas)
UPDATE affiliates 
SET total_conversions = total_conversions + 3,
    total_referrals = total_referrals + 1,
    commission_balance = commission_balance + 7.50,
    total_commission_earned = total_commission_earned + 7.50
WHERE id = '92e39f3b-4ea7-4b9d-a193-5ab981b4112a';
