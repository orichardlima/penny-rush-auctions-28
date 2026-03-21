-- Corrigir compra do Richard Lima (pay_7g3icvoo46lnl9os)
UPDATE bid_purchases SET payment_status = 'completed' 
WHERE payment_id = 'pay_7g3icvoo46lnl9os' AND payment_status = 'pending';

UPDATE profiles SET bids_balance = bids_balance + 65, updated_at = now() 
WHERE user_id = '18c062cb-1bd6-4889-b20f-c359da2f5971';