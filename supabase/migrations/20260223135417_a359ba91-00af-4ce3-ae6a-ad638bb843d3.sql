-- Update all existing PENDING payouts to PAID so they become immediately available for withdrawal
UPDATE partner_payouts 
SET status = 'PAID', paid_at = now() 
WHERE status = 'PENDING';