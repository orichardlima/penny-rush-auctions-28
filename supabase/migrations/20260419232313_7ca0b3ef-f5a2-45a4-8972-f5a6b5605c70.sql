DO $$
DECLARE
  v_purchase_id uuid := '70030b2f-dcf5-44fa-a2cc-40aeb512c8fd';
  v_user_id uuid := '4b6ee529-0241-4d4e-ac8a-e074c97ac5ab';
  v_bids_count int := 15;
  v_old_status text;
  v_old_balance numeric;
  v_new_balance numeric;
  v_admin_id uuid := 'c793d66c-06c5-4fdf-9c2c-0baedd2694f6';
  v_comm_record record;
BEGIN
  SELECT payment_status INTO v_old_status FROM bid_purchases WHERE id = v_purchase_id;
  SELECT bids_balance INTO v_old_balance FROM profiles WHERE user_id = v_user_id;

  IF v_old_status = 'completed' THEN
    RAISE NOTICE 'Already completed';
    RETURN;
  END IF;

  UPDATE bid_purchases SET payment_status = 'completed' WHERE id = v_purchase_id;

  v_new_balance := COALESCE(v_old_balance, 0) + v_bids_count;
  UPDATE profiles SET bids_balance = v_new_balance WHERE user_id = v_user_id;

  FOR v_comm_record IN
    SELECT id, affiliate_id FROM affiliate_commissions
    WHERE purchase_id = v_purchase_id AND status = 'pending'
  LOOP
    UPDATE affiliate_commissions SET status = 'approved', approved_at = now() WHERE id = v_comm_record.id;
    PERFORM increment_affiliate_conversions(v_comm_record.affiliate_id);
  END LOOP;

  INSERT INTO admin_audit_log (
    admin_user_id, admin_name, action_type, target_type, target_id,
    old_values, new_values, description
  ) VALUES (
    v_admin_id, 'Administrador',
    'manual_purchase_confirmation', 'bid_purchase', v_purchase_id,
    jsonb_build_object('payment_status', v_old_status, 'bids_balance', v_old_balance),
    jsonb_build_object('payment_status', 'completed', 'bids_balance', v_new_balance, 'bids_credited', v_bids_count),
    'Confirmação manual — webhook MagenPay não chegou. Comprovante validado em 17/04. Wellington de Oliveira Flor (+15 lances).'
  );
END $$;