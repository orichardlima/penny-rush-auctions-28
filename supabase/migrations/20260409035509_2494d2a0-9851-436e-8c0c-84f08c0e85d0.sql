
-- Table for manual affiliate balance adjustments
CREATE TABLE public.affiliate_manual_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

ALTER TABLE public.affiliate_manual_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage affiliate manual credits"
  ON public.affiliate_manual_credits
  FOR ALL
  USING (is_admin_user(auth.uid()));

-- RPC to atomically adjust affiliate balance with audit
CREATE OR REPLACE FUNCTION public.admin_adjust_affiliate_balance(
  _affiliate_id uuid,
  _amount numeric,
  _reason text,
  _admin_name text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance numeric;
  _admin_id uuid := auth.uid();
BEGIN
  -- Validate admin
  IF NOT is_admin_user(_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Insert credit record
  INSERT INTO affiliate_manual_credits (affiliate_id, amount, reason, created_by)
  VALUES (_affiliate_id, _amount, _reason, _admin_id);

  -- Update balance (and total_commission_earned for positive amounts)
  IF _amount >= 0 THEN
    UPDATE affiliates
    SET commission_balance = commission_balance + _amount,
        total_commission_earned = total_commission_earned + _amount
    WHERE id = _affiliate_id
    RETURNING commission_balance INTO _new_balance;
  ELSE
    UPDATE affiliates
    SET commission_balance = commission_balance + _amount
    WHERE id = _affiliate_id
    RETURNING commission_balance INTO _new_balance;
  END IF;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'Affiliate not found';
  END IF;

  -- Audit log
  INSERT INTO admin_audit_log (admin_user_id, admin_name, action_type, target_type, target_id, description, new_values)
  VALUES (
    _admin_id,
    _admin_name,
    CASE WHEN _amount >= 0 THEN 'affiliate_manual_credit' ELSE 'affiliate_manual_debit' END,
    'affiliate',
    _affiliate_id,
    'Ajuste manual de saldo de afiliado: ' || _reason,
    jsonb_build_object('amount', _amount, 'new_balance', _new_balance, 'reason', _reason)
  );

  RETURN _new_balance;
END;
$$;
