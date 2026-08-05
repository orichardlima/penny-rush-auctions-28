UPDATE public.partner_withdrawals 
SET payment_details = jsonb_set(payment_details, '{pix_key}', '"geanetsouzar@gmal.com"')
WHERE payment_details->>'pix_key' = 'geanetsouzar@gmail.com';