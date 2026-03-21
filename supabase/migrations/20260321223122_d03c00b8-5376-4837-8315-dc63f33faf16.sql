UPDATE bid_purchases 
SET payment_status = 'completed' 
WHERE user_id = '56158a8e-29a5-405f-9c18-d10cbcb5db1d' 
  AND payment_status = 'pending';

UPDATE profiles 
SET bids_balance = bids_balance + 90, updated_at = now() 
WHERE user_id = '56158a8e-29a5-405f-9c18-d10cbcb5db1d';