
ALTER TABLE public.partner_credit_debts
  ADD COLUMN IF NOT EXISTS term_days INTEGER,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.partner_credit_lines
  ADD COLUMN IF NOT EXISTS valid_until DATE;

-- Backfill term_days for existing debts
UPDATE public.partner_credit_debts d
SET term_days = GREATEST(1, (d.due_date - (d.created_at AT TIME ZONE 'America/Bahia')::date))
WHERE d.term_days IS NULL;

UPDATE public.partner_credit_debts
SET paid_amount = amount
WHERE status IN ('PAID','WRITTEN_OFF') AND paid_amount = 0;

-- Available credit now respects valid_until
CREATE OR REPLACE FUNCTION public.partner_credit_available(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT GREATEST(0, limit_amount - used_amount)
     FROM public.partner_credit_lines
     WHERE user_id = _user_id
       AND status = 'ACTIVE'
       AND (valid_until IS NULL OR valid_until >= (now() AT TIME ZONE 'America/Bahia')::date)),
    0
  );
$function$;

-- Admin can set valid_until
CREATE OR REPLACE FUNCTION public.admin_set_credit_line(
  _user_id uuid,
  _limit_amount numeric,
  _default_term_days integer DEFAULT 7,
  _status text DEFAULT 'ACTIVE'::text,
  _notes text DEFAULT NULL::text,
  _valid_until date DEFAULT NULL::date,
  _clear_valid_until boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    INSERT INTO public.partner_credit_lines (user_id, limit_amount, default_term_days, status, notes, valid_until, created_by)
    VALUES (_user_id, _limit_amount, COALESCE(_default_term_days,7), COALESCE(_status,'ACTIVE'), _notes,
            CASE WHEN _clear_valid_until THEN NULL ELSE _valid_until END, auth.uid())
    RETURNING id INTO v_id;
    v_old := 0;
  ELSE
    UPDATE public.partner_credit_lines
    SET limit_amount = _limit_amount,
        default_term_days = COALESCE(_default_term_days, default_term_days),
        status = COALESCE(_status, status),
        notes = COALESCE(_notes, notes),
        valid_until = CASE WHEN _clear_valid_until THEN NULL ELSE COALESCE(_valid_until, valid_until) END,
        updated_at = now()
    WHERE id = v_id;
  END IF;

  INSERT INTO public.partner_credit_transactions (credit_line_id, user_id, tx_type, amount, description, created_by)
  VALUES (v_id, _user_id, 'GRANT', _limit_amount - COALESCE(v_old,0),
          'Limite ajustado de ' || COALESCE(v_old,0)::text || ' para ' || _limit_amount::text, auth.uid());

  RETURN v_id;
END;
$function$;

-- Partial settlement support
CREATE OR REPLACE FUNCTION public.admin_settle_credit_debt(
  _debt_id uuid,
  _write_off boolean DEFAULT false,
  _notes text DEFAULT NULL::text,
  _amount numeric DEFAULT NULL::numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_debt public.partner_credit_debts%ROWTYPE;
  v_remaining NUMERIC;
  v_pay NUMERIC;
  v_full BOOLEAN;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_debt FROM public.partner_credit_debts WHERE id = _debt_id FOR UPDATE;
  IF v_debt.id IS NULL THEN RAISE EXCEPTION 'debt not found'; END IF;
  IF v_debt.status IN ('PAID','WRITTEN_OFF') THEN RETURN TRUE; END IF;

  v_remaining := GREATEST(0, v_debt.amount - COALESCE(v_debt.paid_amount,0));
  v_pay := LEAST(COALESCE(_amount, v_remaining), v_remaining);
  IF v_pay <= 0 THEN RETURN TRUE; END IF;

  v_full := _write_off OR (v_remaining - v_pay) <= 0.009;

  UPDATE public.partner_credit_debts
  SET paid_amount = CASE WHEN _write_off THEN v_debt.amount ELSE COALESCE(paid_amount,0) + v_pay END,
      status = CASE WHEN _write_off THEN 'WRITTEN_OFF'
                    WHEN v_full THEN 'PAID'
                    ELSE status END,
      paid_at = CASE WHEN v_full THEN now() ELSE paid_at END,
      notes = COALESCE(_notes, notes),
      updated_at = now()
  WHERE id = _debt_id;

  UPDATE public.partner_credit_lines
  SET used_amount = GREATEST(0, used_amount - CASE WHEN _write_off THEN v_remaining ELSE v_pay END),
      updated_at = now()
  WHERE id = v_debt.credit_line_id;

  INSERT INTO public.partner_credit_transactions (credit_line_id, user_id, debt_id, tx_type, amount, description, created_by)
  VALUES (v_debt.credit_line_id, v_debt.user_id, _debt_id,
          CASE WHEN _write_off THEN 'WRITE_OFF' ELSE 'REPAYMENT' END,
          CASE WHEN _write_off THEN v_remaining ELSE v_pay END,
          COALESCE(_notes, 'Baixa manual pelo admin'), auth.uid());

  RETURN TRUE;
END;
$function$;
