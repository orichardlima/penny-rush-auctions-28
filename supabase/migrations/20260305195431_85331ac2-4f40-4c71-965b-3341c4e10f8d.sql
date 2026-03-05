
-- Step 1: Delete partner_payouts linked to SUSPENDED contracts
DELETE FROM public.partner_payouts 
WHERE partner_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 2: Delete partner_upgrades linked to SUSPENDED contracts
DELETE FROM public.partner_upgrades 
WHERE partner_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 3: Delete partner_binary_positions linked to SUSPENDED contracts
DELETE FROM public.partner_binary_positions 
WHERE partner_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 4: Also clean up binary_points_log references
DELETE FROM public.binary_points_log
WHERE partner_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
)
OR source_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 5: Delete binary_bonuses linked to SUSPENDED contracts
DELETE FROM public.binary_bonuses
WHERE partner_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 6: Delete fast_start_achievements linked to SUSPENDED contracts
DELETE FROM public.fast_start_achievements
WHERE partner_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 7: Delete partner_early_terminations linked to SUSPENDED contracts
DELETE FROM public.partner_early_terminations
WHERE partner_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 8: Delete partner_manual_credits linked to SUSPENDED contracts
DELETE FROM public.partner_manual_credits
WHERE partner_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 9: Delete ad_center_completions linked to SUSPENDED contracts
DELETE FROM public.ad_center_completions
WHERE partner_contract_id IN (
  SELECT id FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 10: Delete partner_payment_intents linked to SUSPENDED contracts
DELETE FROM public.partner_payment_intents
WHERE user_id IN (
  SELECT user_id FROM public.partner_contracts WHERE status = 'SUSPENDED'
)
AND plan_name IN (
  SELECT plan_name FROM public.partner_contracts WHERE status = 'SUSPENDED'
);

-- Step 11: Finally, delete all 8 SUSPENDED contracts
DELETE FROM public.partner_contracts WHERE status = 'SUSPENDED';
