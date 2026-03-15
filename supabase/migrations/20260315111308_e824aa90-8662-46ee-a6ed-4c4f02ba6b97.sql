-- 1. affiliate_referrals: force converted = false on INSERT
DROP POLICY "Anyone can insert referrals" ON affiliate_referrals;
CREATE POLICY "Anyone can insert referrals" ON affiliate_referrals
  FOR INSERT TO anon, authenticated
  WITH CHECK (converted = false);

-- 2. bid_purchases: remove user INSERT (done by edge function)
DROP POLICY "Users can insert their own purchases" ON bid_purchases;

-- 3. partner_referral_bonuses: remove user INSERT (done by trigger)
DROP POLICY IF EXISTS "Users can create referral bonuses for their referrals" ON partner_referral_bonuses;

-- 4. partner_upgrades: remove user INSERT (done by webhook)
DROP POLICY IF EXISTS "Users can insert own upgrades" ON partner_upgrades;

-- 5. partner_contracts: harden trigger to protect all financial fields
CREATE OR REPLACE FUNCTION protect_partner_contract_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_admin_user(auth.uid()) THEN
    NEW.status := OLD.status;
    NEW.total_cap := OLD.total_cap;
    NEW.weekly_cap := OLD.weekly_cap;
    NEW.aporte_value := OLD.aporte_value;
    NEW.total_received := OLD.total_received;
    NEW.total_withdrawn := OLD.total_withdrawn;
    NEW.available_balance := OLD.available_balance;
    NEW.total_referral_points := OLD.total_referral_points;
    NEW.plan_name := OLD.plan_name;
    NEW.referral_code := OLD.referral_code;
    NEW.payment_status := OLD.payment_status;
    NEW.bonus_bids_received := OLD.bonus_bids_received;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;