UPDATE partner_referral_bonuses 
SET aporte_value = 19998, bonus_value = aporte_value / 9999.0 * 19998.0 * (bonus_percentage / 100.0)
WHERE referred_contract_id = '236eac8e-c587-44cb-bfad-9f78b38a21ce' 
  AND is_fast_start_bonus = false;

UPDATE partner_referral_bonuses 
SET bonus_value = 19998.0 * (bonus_percentage / 100.0),
    aporte_value = 19998
WHERE referred_contract_id = '236eac8e-c587-44cb-bfad-9f78b38a21ce' 
  AND is_fast_start_bonus = false;