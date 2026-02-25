
-- 1. Add missing columns
ALTER TABLE fury_vault_instances
  ADD COLUMN IF NOT EXISTS config_snapshot jsonb NULL;

ALTER TABLE fury_vault_config
  ADD COLUMN IF NOT EXISTS max_cap_absolute numeric NOT NULL DEFAULT 50;

-- 2. Update active preset
UPDATE fury_vault_config SET max_cap_absolute = 50 WHERE is_active = true;

-- 3. Drop existing functions to avoid return type conflicts
DROP FUNCTION IF EXISTS fury_vault_on_bid(uuid, integer);
DROP FUNCTION IF EXISTS fury_vault_distribute(uuid);
DROP FUNCTION IF EXISTS validate_fury_vault_withdrawal() CASCADE;

-- 4. Create fury_vault_on_bid
CREATE FUNCTION fury_vault_on_bid(p_auction_id uuid, p_bid_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault fury_vault_instances%ROWTYPE;
  v_config jsonb;
  v_acc_type text;
  v_acc_value numeric;
  v_acc_interval integer;
  v_max_cap_abs numeric;
  v_fury_enabled boolean;
  v_fury_seconds integer;
  v_fury_multiplier numeric;
  v_increment numeric;
  v_new_value numeric;
  v_auction_time_left integer;
  v_is_fury boolean := false;
BEGIN
  SELECT * INTO v_vault FROM fury_vault_instances
    WHERE auction_id = p_auction_id AND status = 'accumulating'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_vault.config_snapshot IS NOT NULL THEN
    v_config := v_vault.config_snapshot;
  ELSE
    SELECT row_to_json(c) INTO v_config FROM fury_vault_config c WHERE c.is_active = true;
    IF v_config IS NULL THEN RETURN; END IF;
  END IF;

  v_acc_type      := v_config->>'accumulation_type';
  v_acc_value     := (v_config->>'accumulation_value')::numeric;
  v_acc_interval  := (v_config->>'accumulation_interval')::integer;
  v_max_cap_abs   := COALESCE((v_config->>'max_cap_absolute')::numeric, 9999999);
  v_fury_enabled  := COALESCE((v_config->>'fury_mode_enabled')::boolean, false);
  v_fury_seconds  := COALESCE((v_config->>'fury_mode_seconds')::integer, 120);
  v_fury_multiplier := COALESCE((v_config->>'fury_mode_multiplier')::numeric, 2);

  IF v_acc_type = 'fixed_per_x_bids' THEN
    IF (p_bid_number - v_vault.last_increment_at_bid) < v_acc_interval THEN RETURN; END IF;
    v_increment := v_acc_value;
  ELSIF v_acc_type = 'percentage' THEN
    IF (p_bid_number - v_vault.last_increment_at_bid) < v_acc_interval THEN RETURN; END IF;
    SELECT COALESCE(bid_cost, 1) INTO v_increment FROM auctions WHERE id = p_auction_id;
    v_increment := v_increment * (v_acc_value / 100.0);
  ELSE
    RETURN;
  END IF;

  IF v_fury_enabled THEN
    SELECT time_left INTO v_auction_time_left FROM auctions WHERE id = p_auction_id;
    IF v_auction_time_left IS NOT NULL AND v_auction_time_left <= v_fury_seconds THEN
      v_is_fury := true;
      v_increment := v_increment * v_fury_multiplier;
    END IF;
  END IF;

  v_new_value := LEAST(v_vault.current_value + v_increment, LEAST(v_vault.max_cap, v_max_cap_abs));
  IF v_new_value <= v_vault.current_value THEN RETURN; END IF;
  v_increment := v_new_value - v_vault.current_value;

  UPDATE fury_vault_instances SET
    current_value = v_new_value,
    total_increments = total_increments + 1,
    last_increment_at_bid = p_bid_number,
    fury_mode_active = v_is_fury,
    updated_at = now()
  WHERE id = v_vault.id;

  INSERT INTO fury_vault_logs (vault_instance_id, event_type, amount, bid_number, details)
  VALUES (v_vault.id, CASE WHEN v_is_fury THEN 'fury_increment' ELSE 'increment' END,
          v_increment, p_bid_number,
          jsonb_build_object('new_value', v_new_value, 'fury_active', v_is_fury));
END;
$$;

-- 5. Create fury_vault_distribute
CREATE FUNCTION fury_vault_distribute(p_auction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault fury_vault_instances%ROWTYPE;
  v_config jsonb;
  v_dist_mode text;
  v_top_pct numeric;
  v_min_bids integer;
  v_recency integer;
  v_top_user_id uuid;
  v_raffle_user_id uuid;
  v_top_amount numeric;
  v_raffle_amount numeric;
  v_auction_ended_at timestamptz;
  v_qualified_users uuid[];
BEGIN
  SELECT * INTO v_vault FROM fury_vault_instances
    WHERE auction_id = p_auction_id AND status = 'accumulating'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_vault.current_value <= 0 THEN
    UPDATE fury_vault_instances SET status = 'distributed', distributed_at = now(), updated_at = now() WHERE id = v_vault.id;
    RETURN;
  END IF;

  IF v_vault.config_snapshot IS NOT NULL THEN
    v_config := v_vault.config_snapshot;
  ELSE
    SELECT row_to_json(c) INTO v_config FROM fury_vault_config c WHERE c.is_active = true;
    IF v_config IS NULL THEN RETURN; END IF;
  END IF;

  v_dist_mode := COALESCE(v_config->>'distribution_mode', 'hybrid');
  v_top_pct   := COALESCE((v_config->>'hybrid_top_percentage')::numeric, 50);
  v_min_bids  := COALESCE((v_config->>'min_bids_to_qualify')::integer, 15);
  v_recency   := COALESCE((v_config->>'recency_seconds')::integer, 60);

  SELECT COALESCE(finished_at, now()) INTO v_auction_ended_at FROM auctions WHERE id = p_auction_id;

  SELECT array_agg(q.user_id) INTO v_qualified_users
  FROM fury_vault_qualifications q
  WHERE q.vault_instance_id = v_vault.id
    AND q.is_qualified = true
    AND q.total_bids_in_auction >= v_min_bids
    AND q.last_bid_at >= (v_auction_ended_at - (v_recency || ' seconds')::interval);

  IF v_qualified_users IS NULL OR array_length(v_qualified_users, 1) = 0 THEN
    UPDATE fury_vault_instances SET status = 'distributed', distributed_at = now(), updated_at = now() WHERE id = v_vault.id;
    INSERT INTO fury_vault_logs (vault_instance_id, event_type, amount, details)
    VALUES (v_vault.id, 'no_qualified_users', 0, '{"reason":"no qualified users"}'::jsonb);
    RETURN;
  END IF;

  SELECT q.user_id INTO v_top_user_id
  FROM fury_vault_qualifications q
  WHERE q.vault_instance_id = v_vault.id AND q.user_id = ANY(v_qualified_users)
  ORDER BY q.total_bids_in_auction DESC, q.last_bid_at DESC, q.user_id ASC
  LIMIT 1;

  IF v_dist_mode = '100_top' THEN
    v_top_amount := v_vault.current_value; v_raffle_amount := 0; v_raffle_user_id := NULL;
  ELSIF v_dist_mode = '100_raffle' THEN
    v_top_amount := 0; v_raffle_amount := v_vault.current_value;
    SELECT user_id INTO v_raffle_user_id FROM unnest(v_qualified_users) AS user_id ORDER BY random() LIMIT 1;
  ELSE
    v_top_amount := ROUND(v_vault.current_value * v_top_pct / 100, 2);
    v_raffle_amount := v_vault.current_value - v_top_amount;
    IF array_length(v_qualified_users, 1) > 1 THEN
      SELECT u INTO v_raffle_user_id FROM unnest(v_qualified_users) AS u WHERE u != v_top_user_id ORDER BY random() LIMIT 1;
    ELSE
      v_raffle_user_id := v_top_user_id;
    END IF;
  END IF;

  UPDATE fury_vault_instances SET
    status = 'distributed', distributed_at = now(),
    top_bidder_user_id = v_top_user_id, top_bidder_amount = v_top_amount,
    raffle_winner_user_id = v_raffle_user_id, raffle_winner_amount = v_raffle_amount,
    updated_at = now()
  WHERE id = v_vault.id;

  INSERT INTO fury_vault_logs (vault_instance_id, event_type, amount, details)
  VALUES (v_vault.id, 'distribution', v_vault.current_value,
    jsonb_build_object('mode', v_dist_mode, 'top_user', v_top_user_id, 'top_amount', v_top_amount,
      'raffle_user', v_raffle_user_id, 'raffle_amount', v_raffle_amount,
      'qualified_count', array_length(v_qualified_users, 1)));
END;
$$;

-- 6. Create withdrawal validation trigger
CREATE FUNCTION validate_fury_vault_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config fury_vault_config%ROWTYPE;
  v_profile record;
  v_monthly_total numeric;
  v_last_withdrawal timestamptz;
  v_vault_value numeric;
BEGIN
  SELECT * INTO v_config FROM fury_vault_config WHERE is_active = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuração do cofre não encontrada'; END IF;

  IF v_config.require_verified_account THEN
    SELECT p.cpf, p.is_blocked, p.has_chargeback INTO v_profile FROM profiles p WHERE p.user_id = NEW.user_id;
    IF v_profile IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
    IF v_profile.cpf IS NULL OR v_profile.cpf = '' THEN RAISE EXCEPTION 'CPF obrigatório para saque do cofre'; END IF;
    IF COALESCE(v_profile.is_blocked, false) THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;
    IF COALESCE(v_profile.has_chargeback, false) THEN RAISE EXCEPTION 'Conta com chargeback'; END IF;
  END IF;

  IF NEW.amount < v_config.min_withdrawal_amount THEN
    RAISE EXCEPTION 'Valor mínimo de saque: R$ %', v_config.min_withdrawal_amount;
  END IF;

  SELECT MAX(created_at) INTO v_last_withdrawal FROM fury_vault_withdrawals
  WHERE user_id = NEW.user_id AND status != 'rejected' AND id != NEW.id;
  IF v_last_withdrawal IS NOT NULL AND v_last_withdrawal > (now() - (v_config.withdrawal_cooldown_days || ' days')::interval) THEN
    RAISE EXCEPTION 'Aguarde % dias entre saques', v_config.withdrawal_cooldown_days;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_monthly_total FROM fury_vault_withdrawals
  WHERE user_id = NEW.user_id AND status != 'rejected' AND created_at >= date_trunc('month', now()) AND id != NEW.id;

  SELECT COALESCE(SUM(
    CASE WHEN top_bidder_user_id = NEW.user_id THEN top_bidder_amount ELSE 0 END +
    CASE WHEN raffle_winner_user_id = NEW.user_id THEN raffle_winner_amount ELSE 0 END
  ), 0) INTO v_vault_value FROM fury_vault_instances
  WHERE status = 'distributed' AND (top_bidder_user_id = NEW.user_id OR raffle_winner_user_id = NEW.user_id);

  IF v_vault_value > 0 AND ((v_monthly_total + NEW.amount) / v_vault_value * 100) > v_config.max_monthly_withdrawal_pct THEN
    RAISE EXCEPTION 'Limite mensal de saque excedido';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fury_vault_withdrawal
  BEFORE INSERT ON fury_vault_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION validate_fury_vault_withdrawal();
