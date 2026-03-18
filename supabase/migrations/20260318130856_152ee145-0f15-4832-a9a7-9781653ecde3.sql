CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  -- Verificar saldo com lock
  SELECT bids_balance INTO v_balance
  FROM profiles WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 1 THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- Descontar 1 lance
  UPDATE profiles SET bids_balance = bids_balance - 1
  WHERE user_id = p_user_id;

  -- Inserir lance
  INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
  VALUES (p_auction_id, p_user_id, 1, 1.00);
END;
$$;