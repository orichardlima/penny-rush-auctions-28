
-- =====================================================
-- COFRE FÚRIA — Migration Completa
-- 5 tabelas + trigger de acúmulo + função de distribuição + RLS
-- =====================================================

-- 1. fury_vault_config (configuração global)
CREATE TABLE public.fury_vault_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accumulation_type text NOT NULL DEFAULT 'fixed_per_x_bids',
  accumulation_value numeric NOT NULL DEFAULT 0.20,
  accumulation_interval integer NOT NULL DEFAULT 20,
  default_initial_value numeric NOT NULL DEFAULT 0,
  max_cap_type text NOT NULL DEFAULT 'absolute',
  max_cap_value numeric NOT NULL DEFAULT 500,
  min_bids_to_qualify integer NOT NULL DEFAULT 15,
  recency_seconds integer NOT NULL DEFAULT 60,
  distribution_mode text NOT NULL DEFAULT 'hybrid',
  hybrid_top_percentage numeric NOT NULL DEFAULT 50,
  hybrid_raffle_percentage numeric NOT NULL DEFAULT 50,
  fury_mode_enabled boolean NOT NULL DEFAULT false,
  fury_mode_seconds integer NOT NULL DEFAULT 120,
  fury_mode_multiplier numeric NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  min_withdrawal_amount numeric NOT NULL DEFAULT 100,
  max_monthly_withdrawal_pct numeric NOT NULL DEFAULT 50,
  withdrawal_cooldown_days integer NOT NULL DEFAULT 30,
  processing_days integer NOT NULL DEFAULT 3,
  require_verified_account boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fury_vault_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vault config"
  ON public.fury_vault_config FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Authenticated can view vault config"
  ON public.fury_vault_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert default config row
INSERT INTO public.fury_vault_config (id) VALUES (gen_random_uuid());

-- 2. fury_vault_instances (cofre por leilão)
CREATE TABLE public.fury_vault_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  current_value numeric NOT NULL DEFAULT 0,
  initial_value numeric NOT NULL DEFAULT 0,
  max_cap numeric NOT NULL DEFAULT 500,
  total_increments integer NOT NULL DEFAULT 0,
  last_increment_at_bid integer NOT NULL DEFAULT 0,
  fury_mode_active boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'accumulating',
  top_bidder_user_id uuid NULL,
  top_bidder_amount numeric NOT NULL DEFAULT 0,
  raffle_winner_user_id uuid NULL,
  raffle_winner_amount numeric NOT NULL DEFAULT 0,
  distributed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(auction_id)
);

ALTER TABLE public.fury_vault_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vault instances"
  ON public.fury_vault_instances FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Anyone can view vault instances"
  ON public.fury_vault_instances FOR SELECT
  USING (true);

-- 3. fury_vault_logs (histórico de acúmulo)
CREATE TABLE public.fury_vault_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vault_instance_id uuid NOT NULL REFERENCES public.fury_vault_instances(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  bid_number integer NULL,
  details jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fury_vault_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vault logs"
  ON public.fury_vault_logs FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Anyone can view vault logs"
  ON public.fury_vault_logs FOR SELECT
  USING (true);

-- 4. fury_vault_qualifications (usuários qualificados)
CREATE TABLE public.fury_vault_qualifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vault_instance_id uuid NOT NULL REFERENCES public.fury_vault_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  total_bids_in_auction integer NOT NULL DEFAULT 0,
  last_bid_at timestamptz NULL,
  is_qualified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vault_instance_id, user_id)
);

ALTER TABLE public.fury_vault_qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vault qualifications"
  ON public.fury_vault_qualifications FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view own qualifications"
  ON public.fury_vault_qualifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view qualification counts"
  ON public.fury_vault_qualifications FOR SELECT
  USING (true);

-- 5. fury_vault_withdrawals (saques de prêmios)
CREATE TABLE public.fury_vault_withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  source_vault_id uuid NOT NULL REFERENCES public.fury_vault_instances(id),
  processed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fury_vault_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vault withdrawals"
  ON public.fury_vault_withdrawals FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view own withdrawals"
  ON public.fury_vault_withdrawals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own withdrawals"
  ON public.fury_vault_withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- TRIGGER: Acúmulo automático a cada lance
-- =====================================================

CREATE OR REPLACE FUNCTION public.fury_vault_on_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance fury_vault_instances%ROWTYPE;
  v_config fury_vault_config%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_total_bids integer;
  v_increment numeric;
  v_multiplier numeric := 1;
  v_is_fury_mode boolean := false;
  v_seconds_remaining numeric;
BEGIN
  -- Get vault instance for this auction
  SELECT * INTO v_instance
  FROM fury_vault_instances
  WHERE auction_id = NEW.auction_id AND status = 'accumulating'
  LIMIT 1;

  IF v_instance.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get global config
  SELECT * INTO v_config
  FROM fury_vault_config
  WHERE is_active = true
  LIMIT 1;

  IF v_config.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get auction for ends_at
  SELECT * INTO v_auction
  FROM auctions WHERE id = NEW.auction_id;

  -- Count total bids in this auction
  SELECT COUNT(*) INTO v_total_bids
  FROM bids WHERE auction_id = NEW.auction_id;

  -- Check Fury Mode (last X seconds)
  IF v_config.fury_mode_enabled AND v_auction.ends_at IS NOT NULL THEN
    v_seconds_remaining := EXTRACT(EPOCH FROM (v_auction.ends_at - now()));
    IF v_seconds_remaining > 0 AND v_seconds_remaining <= v_config.fury_mode_seconds THEN
      v_is_fury_mode := true;
      v_multiplier := v_config.fury_mode_multiplier;
    END IF;
  END IF;

  -- Update fury_mode_active on instance if changed
  IF v_instance.fury_mode_active IS DISTINCT FROM v_is_fury_mode THEN
    UPDATE fury_vault_instances
    SET fury_mode_active = v_is_fury_mode, updated_at = now()
    WHERE id = v_instance.id;

    IF v_is_fury_mode THEN
      INSERT INTO fury_vault_logs (vault_instance_id, event_type, amount, bid_number, details)
      VALUES (v_instance.id, 'fury_activated', 0, v_total_bids,
              jsonb_build_object('multiplier', v_multiplier, 'seconds_remaining', v_seconds_remaining));
    END IF;
  END IF;

  -- Check if we should increment (interval check)
  IF v_config.accumulation_type = 'fixed_per_x_bids' THEN
    IF v_total_bids > 0 AND (v_total_bids % v_config.accumulation_interval) = 0 THEN
      v_increment := v_config.accumulation_value * v_multiplier;

      -- Check cap
      IF (v_instance.current_value + v_increment) > v_instance.max_cap THEN
        v_increment := GREATEST(v_instance.max_cap - v_instance.current_value, 0);

        IF v_increment > 0 THEN
          INSERT INTO fury_vault_logs (vault_instance_id, event_type, amount, bid_number)
          VALUES (v_instance.id, 'cap_reached', v_increment, v_total_bids);
        END IF;
      END IF;

      IF v_increment > 0 THEN
        UPDATE fury_vault_instances
        SET current_value = current_value + v_increment,
            total_increments = total_increments + 1,
            last_increment_at_bid = v_total_bids,
            updated_at = now()
        WHERE id = v_instance.id;

        INSERT INTO fury_vault_logs (vault_instance_id, event_type, amount, bid_number, details)
        VALUES (v_instance.id, 'increment', v_increment, v_total_bids,
                jsonb_build_object('multiplier', v_multiplier, 'fury_mode', v_is_fury_mode));
      END IF;
    END IF;
  END IF;

  -- Upsert user qualification
  INSERT INTO fury_vault_qualifications (vault_instance_id, user_id, total_bids_in_auction, last_bid_at, is_qualified, updated_at)
  VALUES (
    v_instance.id,
    NEW.user_id,
    1,
    NEW.created_at,
    false,
    now()
  )
  ON CONFLICT (vault_instance_id, user_id) DO UPDATE SET
    total_bids_in_auction = fury_vault_qualifications.total_bids_in_auction + 1,
    last_bid_at = NEW.created_at,
    is_qualified = (fury_vault_qualifications.total_bids_in_auction + 1) >= v_config.min_bids_to_qualify,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER fury_vault_bid_trigger
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.fury_vault_on_bid();

-- =====================================================
-- FUNCTION: Distribuição do cofre (chamada pela edge function)
-- =====================================================

CREATE OR REPLACE FUNCTION public.fury_vault_distribute(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance fury_vault_instances%ROWTYPE;
  v_config fury_vault_config%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_top_user_id uuid;
  v_top_bids integer;
  v_raffle_user_id uuid;
  v_top_amount numeric := 0;
  v_raffle_amount numeric := 0;
  v_qualified_count integer;
  v_raffle_seed text;
  v_result jsonb;
BEGIN
  -- Get instance
  SELECT * INTO v_instance
  FROM fury_vault_instances
  WHERE auction_id = p_auction_id AND status = 'accumulating'
  LIMIT 1;

  IF v_instance.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_vault');
  END IF;

  IF v_instance.current_value <= 0 THEN
    UPDATE fury_vault_instances SET status = 'completed', updated_at = now() WHERE id = v_instance.id;
    RETURN jsonb_build_object('status', 'empty_vault');
  END IF;

  -- Get config
  SELECT * INTO v_config FROM fury_vault_config WHERE is_active = true LIMIT 1;
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id;

  -- Update recency qualification
  UPDATE fury_vault_qualifications
  SET is_qualified = (
    total_bids_in_auction >= v_config.min_bids_to_qualify
    AND last_bid_at >= (COALESCE(v_auction.finished_at, now()) - (v_config.recency_seconds || ' seconds')::interval)
  )
  WHERE vault_instance_id = v_instance.id;

  -- Count qualified
  SELECT COUNT(*) INTO v_qualified_count
  FROM fury_vault_qualifications
  WHERE vault_instance_id = v_instance.id AND is_qualified = true;

  IF v_qualified_count = 0 THEN
    UPDATE fury_vault_instances SET status = 'completed', updated_at = now() WHERE id = v_instance.id;
    RETURN jsonb_build_object('status', 'no_qualified_users', 'vault_value', v_instance.current_value);
  END IF;

  -- Mark as distributing
  UPDATE fury_vault_instances SET status = 'distributing', updated_at = now() WHERE id = v_instance.id;

  -- Find top bidder (qualified)
  SELECT user_id, total_bids_in_auction INTO v_top_user_id, v_top_bids
  FROM fury_vault_qualifications
  WHERE vault_instance_id = v_instance.id AND is_qualified = true
  ORDER BY total_bids_in_auction DESC, last_bid_at ASC
  LIMIT 1;

  -- Calculate amounts based on distribution mode
  IF v_config.distribution_mode = '100_top' THEN
    v_top_amount := v_instance.current_value;
  ELSIF v_config.distribution_mode = '100_raffle' THEN
    v_raffle_amount := v_instance.current_value;
  ELSE -- hybrid
    v_top_amount := ROUND(v_instance.current_value * v_config.hybrid_top_percentage / 100, 2);
    v_raffle_amount := v_instance.current_value - v_top_amount;
  END IF;

  -- Credit top bidder
  IF v_top_amount > 0 AND v_top_user_id IS NOT NULL THEN
    UPDATE profiles SET bids_balance = bids_balance + v_top_amount WHERE user_id = v_top_user_id;

    INSERT INTO fury_vault_logs (vault_instance_id, event_type, amount, details)
    VALUES (v_instance.id, 'distribution_top', v_top_amount,
            jsonb_build_object('user_id', v_top_user_id, 'total_bids', v_top_bids));
  END IF;

  -- Raffle among qualified (excluding top bidder if hybrid)
  IF v_raffle_amount > 0 THEN
    v_raffle_seed := gen_random_uuid()::text;

    IF v_config.distribution_mode = 'hybrid' THEN
      SELECT user_id INTO v_raffle_user_id
      FROM fury_vault_qualifications
      WHERE vault_instance_id = v_instance.id AND is_qualified = true AND user_id != v_top_user_id
      ORDER BY md5(v_raffle_seed || user_id::text)
      LIMIT 1;

      -- If no other qualified user, give to top bidder
      IF v_raffle_user_id IS NULL THEN
        v_raffle_user_id := v_top_user_id;
      END IF;
    ELSE
      SELECT user_id INTO v_raffle_user_id
      FROM fury_vault_qualifications
      WHERE vault_instance_id = v_instance.id AND is_qualified = true
      ORDER BY md5(v_raffle_seed || user_id::text)
      LIMIT 1;
    END IF;

    IF v_raffle_user_id IS NOT NULL THEN
      UPDATE profiles SET bids_balance = bids_balance + v_raffle_amount WHERE user_id = v_raffle_user_id;

      INSERT INTO fury_vault_logs (vault_instance_id, event_type, amount, details)
      VALUES (v_instance.id, 'distribution_raffle', v_raffle_amount,
              jsonb_build_object('user_id', v_raffle_user_id, 'seed', v_raffle_seed, 'qualified_count', v_qualified_count));
    END IF;
  END IF;

  -- Update instance as completed
  UPDATE fury_vault_instances
  SET status = 'completed',
      top_bidder_user_id = v_top_user_id,
      top_bidder_amount = v_top_amount,
      raffle_winner_user_id = v_raffle_user_id,
      raffle_winner_amount = v_raffle_amount,
      distributed_at = now(),
      updated_at = now()
  WHERE id = v_instance.id;

  v_result := jsonb_build_object(
    'status', 'distributed',
    'vault_value', v_instance.current_value,
    'top_bidder_user_id', v_top_user_id,
    'top_bidder_amount', v_top_amount,
    'raffle_winner_user_id', v_raffle_user_id,
    'raffle_winner_amount', v_raffle_amount,
    'qualified_count', v_qualified_count
  );

  RETURN v_result;
END;
$$;

-- Enable realtime for vault instances
ALTER PUBLICATION supabase_realtime ADD TABLE fury_vault_instances;
