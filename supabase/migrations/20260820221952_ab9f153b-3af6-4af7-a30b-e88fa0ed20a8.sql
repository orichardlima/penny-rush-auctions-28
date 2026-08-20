-- ============ CAIXA DE CRÉDITO DE CONFIANÇA ============

CREATE TABLE public.partner_credit_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  limit_amount NUMERIC NOT NULL DEFAULT 0 CHECK (limit_amount >= 0),
  used_amount NUMERIC NOT NULL DEFAULT 0 CHECK (used_amount >= 0),
  default_term_days INTEGER NOT NULL DEFAULT 7 CHECK (default_term_days > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_credit_lines TO authenticated;
GRANT ALL ON public.partner_credit_lines TO service_role;
ALTER TABLE public.partner_credit_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leader reads own credit line"
  ON public.partner_credit_lines FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY "Admins manage credit lines"
  ON public.partner_credit_lines FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE public.partner_credit_debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_line_id UUID NOT NULL REFERENCES public.partner_credit_lines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  contract_id UUID,
  referred_email TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PAID','OVERDUE','WRITTEN_OFF')),
  paid_at TIMESTAMPTZ,
  payment_transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_debts_user ON public.partner_credit_debts(user_id, status);
CREATE INDEX idx_credit_debts_line ON public.partner_credit_debts(credit_line_id);

GRANT SELECT ON public.partner_credit_debts TO authenticated;
GRANT ALL ON public.partner_credit_debts TO service_role;
ALTER TABLE public.partner_credit_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leader reads own debts"
  ON public.partner_credit_debts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY "Admins manage debts"
  ON public.partner_credit_debts FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE public.partner_credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_line_id UUID NOT NULL REFERENCES public.partner_credit_lines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  debt_id UUID REFERENCES public.partner_credit_debts(id) ON DELETE SET NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('GRANT','USE','REPAYMENT','ADJUSTMENT','WRITE_OFF')),
  amount NUMERIC NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_tx_user ON public.partner_credit_transactions(user_id, created_at DESC);

GRANT SELECT ON public.partner_credit_transactions TO authenticated;
GRANT ALL ON public.partner_credit_transactions TO service_role;
ALTER TABLE public.partner_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leader reads own credit transactions"
  ON public.partner_credit_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY "Admins manage credit transactions"
  ON public.partner_credit_transactions FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_credit_lines_updated_at
  BEFORE UPDATE ON public.partner_credit_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_credit_debts_updated_at
  BEFORE UPDATE ON public.partner_credit_debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUNÇÕES DE APOIO ============

CREATE OR REPLACE FUNCTION public.partner_credit_available(_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT GREATEST(0, limit_amount - used_amount)
     FROM public.partner_credit_lines
     WHERE user_id = _user_id AND status = 'ACTIVE'),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.partner_credit_is_blocked(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_credit_debts
    WHERE user_id = _user_id
      AND status IN ('OPEN','OVERDUE')
      AND due_date < (now() AT TIME ZONE 'America/Bahia')::date
  );
$$;

GRANT EXECUTE ON FUNCTION public.partner_credit_available(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.partner_credit_is_blocked(UUID) TO authenticated, service_role;

-- Bloqueio de saque enquanto houver dívida vencida
CREATE OR REPLACE FUNCTION public.block_withdrawal_on_credit_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.partner_contracts
  WHERE id = NEW.partner_contract_id;

  IF v_user_id IS NOT NULL AND public.partner_credit_is_blocked(v_user_id) THEN
    RAISE EXCEPTION 'Saque bloqueado: existe crédito de confiança vencido em aberto. Regularize para liberar saques.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_withdrawal_on_credit_default
  BEFORE INSERT ON public.partner_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.block_withdrawal_on_credit_default();

-- Rotina diária: marca dívidas vencidas
CREATE OR REPLACE FUNCTION public.partner_credit_mark_overdue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.partner_credit_debts
  SET status = 'OVERDUE', updated_at = now()
  WHERE status = 'OPEN'
    AND due_date < (now() AT TIME ZONE 'America/Bahia')::date;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_credit_mark_overdue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_credit_mark_overdue() TO service_role, postgres;

-- ============ RPCs ADMIN ============

CREATE OR REPLACE FUNCTION public.admin_set_credit_line(
  _user_id UUID,
  _limit_amount NUMERIC,
  _default_term_days INTEGER DEFAULT 7,
  _status TEXT DEFAULT 'ACTIVE',
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_old NUMERIC;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id, limit_amount INTO v_id, v_old
  FROM public.partner_credit_lines WHERE user_id = _user_id;

  IF v_id IS NULL THEN
    INSERT INTO public.partner_credit_lines (user_id, limit_amount, default_term_days, status, notes, created_by)
    VALUES (_user_id, _limit_amount, COALESCE(_default_term_days,7), COALESCE(_status,'ACTIVE'), _notes, auth.uid())
    RETURNING id INTO v_id;
    v_old := 0;
  ELSE
    UPDATE public.partner_credit_lines
    SET limit_amount = _limit_amount,
        default_term_days = COALESCE(_default_term_days, default_term_days),
        status = COALESCE(_status, status),
        notes = COALESCE(_notes, notes),
        updated_at = now()
    WHERE id = v_id;
  END IF;

  INSERT INTO public.partner_credit_transactions (credit_line_id, user_id, tx_type, amount, description, created_by)
  VALUES (v_id, _user_id, 'GRANT', _limit_amount - COALESCE(v_old,0),
          'Limite ajustado de ' || COALESCE(v_old,0)::text || ' para ' || _limit_amount::text, auth.uid());

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_settle_credit_debt(
  _debt_id UUID,
  _write_off BOOLEAN DEFAULT FALSE,
  _notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debt public.partner_credit_debts%ROWTYPE;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_debt FROM public.partner_credit_debts WHERE id = _debt_id FOR UPDATE;
  IF v_debt.id IS NULL THEN RAISE EXCEPTION 'debt not found'; END IF;
  IF v_debt.status IN ('PAID','WRITTEN_OFF') THEN RETURN TRUE; END IF;

  UPDATE public.partner_credit_debts
  SET status = CASE WHEN _write_off THEN 'WRITTEN_OFF' ELSE 'PAID' END,
      paid_at = now(),
      notes = COALESCE(_notes, notes),
      updated_at = now()
  WHERE id = _debt_id;

  UPDATE public.partner_credit_lines
  SET used_amount = GREATEST(0, used_amount - v_debt.amount), updated_at = now()
  WHERE id = v_debt.credit_line_id;

  INSERT INTO public.partner_credit_transactions (credit_line_id, user_id, debt_id, tx_type, amount, description, created_by)
  VALUES (v_debt.credit_line_id, v_debt.user_id, _debt_id,
          CASE WHEN _write_off THEN 'WRITE_OFF' ELSE 'REPAYMENT' END,
          v_debt.amount, COALESCE(_notes, 'Baixa manual pelo admin'), auth.uid());

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_credit_line(UUID, NUMERIC, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_settle_credit_debt(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_credit_line(UUID, NUMERIC, INTEGER, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_settle_credit_debt(UUID, BOOLEAN, TEXT) TO authenticated, service_role;