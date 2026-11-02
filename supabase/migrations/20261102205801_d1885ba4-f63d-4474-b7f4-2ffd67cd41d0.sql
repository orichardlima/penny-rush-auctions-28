CREATE OR REPLACE FUNCTION public.process_fast_start_bonus(p_contract_id uuid, p_tier_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tier RECORD; v_contract RECORD; v_bonus RECORD;
  v_extra_pct numeric; v_extra_value numeric; v_total_extra numeric := 0;
  v_referrals_count integer; v_window_end timestamptz; v_prev_extra_pct numeric := 0;
BEGIN
  SELECT * INTO v_tier FROM fast_start_tiers WHERE id = p_tier_id AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_contract FROM partner_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_window_end := v_contract.created_at + interval '30 days';

  IF EXISTS (SELECT 1 FROM fast_start_achievements WHERE partner_contract_id = p_contract_id
             AND extra_percentage_applied >= v_tier.extra_percentage AND processed = true) THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(extra_percentage_applied), 0) INTO v_prev_extra_pct
  FROM fast_start_achievements WHERE partner_contract_id = p_contract_id AND processed = true;
  IF v_tier.extra_percentage <= v_prev_extra_pct THEN RETURN; END IF;
  v_extra_pct := v_tier.extra_percentage - v_prev_extra_pct;

  SELECT COUNT(*) INTO v_referrals_count FROM partner_referral_bonuses
  WHERE referrer_contract_id = p_contract_id AND referral_level = 1 AND status != 'CANCELLED'
    AND is_fast_start_bonus = false AND created_at <= v_window_end;

  FOR v_bonus IN
    SELECT * FROM partner_referral_bonuses
    WHERE referrer_contract_id = p_contract_id AND referral_level = 1 AND status != 'CANCELLED'
      AND is_fast_start_bonus = false AND created_at <= v_window_end
  LOOP
    v_extra_value := (v_bonus.aporte_value * v_extra_pct) / 100;
    -- Um complemento por bônus original (mesmo evento). Se a faixa anterior já
    -- criou o complemento, soma apenas a diferença incremental da nova faixa.
    INSERT INTO partner_referral_bonuses AS prb (
      referrer_contract_id, referred_contract_id, referred_user_id, aporte_value,
      bonus_percentage, bonus_value, referral_level, status, is_fast_start_bonus, source_event
    ) VALUES (
      p_contract_id, v_bonus.referred_contract_id, v_bonus.referred_user_id, v_bonus.aporte_value,
      v_extra_pct, v_extra_value, 1, 'PENDING', true, v_bonus.source_event
    ) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus, source_event)
    DO UPDATE SET bonus_percentage = prb.bonus_percentage + EXCLUDED.bonus_percentage,
                  bonus_value = prb.bonus_value + EXCLUDED.bonus_value,
                  updated_at = now()
    WHERE prb.referrer_contract_id = EXCLUDED.referrer_contract_id AND prb.status <> 'CANCELLED';
    IF FOUND THEN v_total_extra := v_total_extra + v_extra_value; END IF;
  END LOOP;

  INSERT INTO fast_start_achievements (partner_contract_id, tier_id, referrals_count,
    extra_percentage_applied, total_extra_bonus, processed)
  VALUES (p_contract_id, p_tier_id, v_referrals_count, v_tier.extra_percentage, v_total_extra, true);
END;
$$;