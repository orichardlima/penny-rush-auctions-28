-- Marcar as 2 compras PIX expiradas como failed (constraint só aceita pending/completed/failed)
UPDATE public.bid_purchases
SET payment_status = 'failed'
WHERE (id::text LIKE '3e987807%' OR id::text LIKE '27c2fae8%')
  AND payment_status = 'pending';

-- Cancelar as comissões pendentes vinculadas a essas compras
UPDATE public.affiliate_commissions
SET status = 'cancelled'
WHERE purchase_id IN (
  SELECT id FROM public.bid_purchases
  WHERE (id::text LIKE '3e987807%' OR id::text LIKE '27c2fae8%')
)
  AND status = 'pending';