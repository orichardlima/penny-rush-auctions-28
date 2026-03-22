
-- 1. Aprovar 17 comissões pendentes cujas compras já foram pagas
UPDATE affiliate_commissions ac
SET status = 'approved', approved_at = NOW()
FROM bid_purchases bp
WHERE ac.purchase_id = bp.id
  AND ac.affiliate_id = '92e39f3b-4ea7-4b9d-a193-5ab981b4112a'
  AND ac.status = 'pending'
  AND bp.payment_status = 'completed';

-- 2. Reverter comissão aprovada cuja compra não foi paga
UPDATE affiliate_commissions
SET status = 'pending', approved_at = NULL
WHERE affiliate_id = '92e39f3b-4ea7-4b9d-a193-5ab981b4112a'
  AND status = 'approved'
  AND purchase_id IN (
    SELECT id FROM bid_purchases WHERE payment_status = 'pending'
  );

-- 3. Corrigir saldo para o valor real
UPDATE affiliates
SET commission_balance = 531.50,
    total_commission_earned = 531.50
WHERE id = '92e39f3b-4ea7-4b9d-a193-5ab981b4112a';
