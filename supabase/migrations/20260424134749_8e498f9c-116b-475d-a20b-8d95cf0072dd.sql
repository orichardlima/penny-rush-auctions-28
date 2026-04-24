UPDATE partner_payment_intents ppi
SET payment_status = 'approved'
WHERE ppi.payment_status = 'pending'
  AND EXISTS (
    SELECT 1 FROM partner_contracts pc
    WHERE pc.user_id = ppi.user_id 
      AND pc.status = 'ACTIVE'
  );