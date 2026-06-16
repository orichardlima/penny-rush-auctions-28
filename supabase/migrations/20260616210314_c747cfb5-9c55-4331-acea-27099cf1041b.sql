
-- ============================================================
-- BID LOTS: validade de 30 dias para compras e bônus de contrato
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bid_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'unknown',
  source_ref uuid,
  initial_amount numeric NOT NULL CHECK (initial_amount >= 0),
  remaining_amount numeric NOT NULL CHECK (remaining_amount >= 0),
  expires_at timestamptz,
  expired_amount numeric NOT NULL DEFAULT 0,
  notified_7d_at timestamptz,
  notified_1d_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bid_lots TO authenticated;
GRANT ALL ON public.bid_lots TO service_role;

ALTER TABLE public.bid_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own bid_lots"
  ON public.bid_lots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all bid_lots"
  ON public.bid_lots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));

CREATE INDEX IF NOT EXISTS idx_bid_lots_user_active
  ON public.bid_lots (user_id, expires_at NULLS LAST, created_at)
  WHERE remaining_amount > 0;

CREATE INDEX IF NOT EXISTS idx_bid_lots_expiring
  ON public.bid_lots (expires_at)
  WHERE remaining_amount > 0 AND expires_at IS NOT NULL;

CREATE TRIGGER trg_bid_lots_updated_at
  BEFORE UPDATE ON public.bid_lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Consumo FIFO por expiração
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_bid_lots(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric := p_amount;
  v_lot RECORD;
  v_take numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;

  FOR v_lot IN
    SELECT id, remaining_amount
      FROM public.bid_lots
     WHERE user_id = p_user_id AND remaining_amount > 0
     ORDER BY expires_at NULLS LAST, created_at ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_lot.remaining_amount, v_remaining);
    UPDATE public.bid_lots
       SET remaining_amount = remaining_amount - v_take
     WHERE id = v_lot.id;
    v_remaining := v_remaining - v_take;
  END LOOP;
  -- Se sobrar v_remaining > 0, ignoramos (saldo legacy sem lote) — não bloqueia.
END;
$$;

-- ============================================================
-- Trigger em profiles: registra/consume lotes via delta
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_bid_lots_on_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta numeric;
  v_source text;
  v_expires_raw text;
  v_expires timestamptz;
  v_ref_raw text;
  v_ref uuid;
BEGIN
  v_delta := COALESCE(NEW.bids_balance, 0) - COALESCE(OLD.bids_balance, 0);

  IF v_delta > 0 THEN
    v_source := NULLIF(current_setting('app.bid_credit_source', true), '');
    IF v_source IS NULL THEN v_source := 'unknown'; END IF;

    v_expires_raw := NULLIF(current_setting('app.bid_credit_expires_at', true), '');
    IF v_expires_raw IS NOT NULL THEN
      BEGIN v_expires := v_expires_raw::timestamptz; EXCEPTION WHEN OTHERS THEN v_expires := NULL; END;
    END IF;

    v_ref_raw := NULLIF(current_setting('app.bid_credit_source_ref', true), '');
    IF v_ref_raw IS NOT NULL THEN
      BEGIN v_ref := v_ref_raw::uuid; EXCEPTION WHEN OTHERS THEN v_ref := NULL; END;
    END IF;

    INSERT INTO public.bid_lots (user_id, source, source_ref, initial_amount, remaining_amount, expires_at)
    VALUES (NEW.user_id, v_source, v_ref, v_delta, v_delta, v_expires);

    -- limpa GUCs para não vazar para próximas operações na mesma sessão
    PERFORM set_config('app.bid_credit_source', '', true);
    PERFORM set_config('app.bid_credit_expires_at', '', true);
    PERFORM set_config('app.bid_credit_source_ref', '', true);

  ELSIF v_delta < 0 THEN
    PERFORM public.consume_bid_lots(NEW.user_id, -v_delta);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bid_lots ON public.profiles;
CREATE TRIGGER trg_sync_bid_lots
  AFTER UPDATE OF bids_balance ON public.profiles
  FOR EACH ROW
  WHEN (OLD.bids_balance IS DISTINCT FROM NEW.bids_balance)
  EXECUTE FUNCTION public.sync_bid_lots_on_profile_update();

-- ============================================================
-- Crédito de bônus de contrato → marca expiração de 30 dias
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_partner_bonus_bids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ACTIVE'
     AND COALESCE(NEW.bonus_bids_received, 0) > 0
     AND NEW.is_demo = false THEN

    PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
    PERFORM set_config('app.bid_credit_source', 'partner_contract', true);
    PERFORM set_config('app.bid_credit_expires_at', (now() + interval '30 days')::text, true);
    PERFORM set_config('app.bid_credit_source_ref', NEW.id::text, true);

    UPDATE profiles
       SET bids_balance = bids_balance + NEW.bonus_bids_received,
           updated_at = now()
     WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- Expiração horária
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_bid_lots()
RETURNS TABLE(expired_lots int, expired_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_count int := 0;
  v_total numeric := 0;
BEGIN
  FOR v_rec IN
    SELECT id, user_id, remaining_amount
      FROM public.bid_lots
     WHERE expires_at IS NOT NULL
       AND expires_at < now()
       AND remaining_amount > 0
     FOR UPDATE
  LOOP
    UPDATE public.bid_lots
       SET remaining_amount = 0,
           expired_amount = expired_amount + v_rec.remaining_amount
     WHERE id = v_rec.id;

    -- decrementa o saldo do profile bypassando proteção e o próprio trigger de lotes
    PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
    PERFORM set_config('app.bid_credit_source', 'lot_expiration_internal', true);
    UPDATE public.profiles
       SET bids_balance = GREATEST(0, COALESCE(bids_balance,0) - v_rec.remaining_amount),
           updated_at = now()
     WHERE user_id = v_rec.user_id;

    v_count := v_count + 1;
    v_total := v_total + v_rec.remaining_amount;
  END LOOP;

  RETURN QUERY SELECT v_count, v_total;
END;
$$;

-- Cuidado: o UPDATE acima vai chamar trg_sync_bid_lots com delta negativo, que chamará consume_bid_lots.
-- Mas como já zeramos remaining_amount do lote, ele só consumirá outros lotes — o que está errado.
-- Solução: marca uma GUC que pula o trigger.

CREATE OR REPLACE FUNCTION public.sync_bid_lots_on_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta numeric;
  v_source text;
  v_expires_raw text;
  v_expires timestamptz;
  v_ref_raw text;
  v_ref uuid;
  v_skip text;
BEGIN
  v_skip := NULLIF(current_setting('app.skip_bid_lot_sync', true), '');
  IF v_skip = 'true' THEN
    PERFORM set_config('app.skip_bid_lot_sync', '', true);
    RETURN NEW;
  END IF;

  v_delta := COALESCE(NEW.bids_balance, 0) - COALESCE(OLD.bids_balance, 0);

  IF v_delta > 0 THEN
    v_source := NULLIF(current_setting('app.bid_credit_source', true), '');
    IF v_source IS NULL THEN v_source := 'unknown'; END IF;

    v_expires_raw := NULLIF(current_setting('app.bid_credit_expires_at', true), '');
    IF v_expires_raw IS NOT NULL THEN
      BEGIN v_expires := v_expires_raw::timestamptz; EXCEPTION WHEN OTHERS THEN v_expires := NULL; END;
    END IF;

    v_ref_raw := NULLIF(current_setting('app.bid_credit_source_ref', true), '');
    IF v_ref_raw IS NOT NULL THEN
      BEGIN v_ref := v_ref_raw::uuid; EXCEPTION WHEN OTHERS THEN v_ref := NULL; END;
    END IF;

    INSERT INTO public.bid_lots (user_id, source, source_ref, initial_amount, remaining_amount, expires_at)
    VALUES (NEW.user_id, v_source, v_ref, v_delta, v_delta, v_expires);

    PERFORM set_config('app.bid_credit_source', '', true);
    PERFORM set_config('app.bid_credit_expires_at', '', true);
    PERFORM set_config('app.bid_credit_source_ref', '', true);

  ELSIF v_delta < 0 THEN
    PERFORM public.consume_bid_lots(NEW.user_id, -v_delta);
  END IF;

  RETURN NEW;
END;
$$;

-- Reescreve expire usando skip_bid_lot_sync
CREATE OR REPLACE FUNCTION public.expire_bid_lots()
RETURNS TABLE(expired_lots int, expired_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_count int := 0;
  v_total numeric := 0;
BEGIN
  FOR v_rec IN
    SELECT id, user_id, remaining_amount
      FROM public.bid_lots
     WHERE expires_at IS NOT NULL
       AND expires_at < now()
       AND remaining_amount > 0
     FOR UPDATE
  LOOP
    UPDATE public.bid_lots
       SET remaining_amount = 0,
           expired_amount = expired_amount + v_rec.remaining_amount
     WHERE id = v_rec.id;

    PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
    PERFORM set_config('app.skip_bid_lot_sync', 'true', true);
    UPDATE public.profiles
       SET bids_balance = GREATEST(0, COALESCE(bids_balance,0) - v_rec.remaining_amount),
           updated_at = now()
     WHERE user_id = v_rec.user_id;

    v_count := v_count + 1;
    v_total := v_total + v_rec.remaining_amount;
  END LOOP;

  RETURN QUERY SELECT v_count, v_total;
END;
$$;

-- ============================================================
-- Notificação 7d / 1d antes — apenas registra notificação in-app.
-- E-mails são opcionais e podem ser ligados depois.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_bid_expirations()
RETURNS TABLE(window_label text, users_notified int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_7 int := 0;
  v_count_1 int := 0;
BEGIN
  -- 7 dias
  WITH agg AS (
    SELECT user_id, SUM(remaining_amount) AS total, MIN(expires_at) AS earliest, array_agg(id) AS lot_ids
      FROM public.bid_lots
     WHERE remaining_amount > 0
       AND notified_7d_at IS NULL
       AND expires_at BETWEEN now() + interval '6 days 12 hours' AND now() + interval '7 days 12 hours'
     GROUP BY user_id
  ),
  ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT user_id, 'bid_expiration_warning',
           'Seus lances expiram em 7 dias',
           total || ' lances vão expirar em ' || to_char(earliest, 'DD/MM/YYYY') || '. Use-os antes!',
           jsonb_build_object('amount', total, 'expires_at', earliest, 'window', '7d')
      FROM agg
    RETURNING 1
  ),
  upd AS (
    UPDATE public.bid_lots SET notified_7d_at = now()
     WHERE id IN (SELECT unnest(lot_ids) FROM agg)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count_7 FROM ins;

  -- 1 dia
  WITH agg AS (
    SELECT user_id, SUM(remaining_amount) AS total, MIN(expires_at) AS earliest, array_agg(id) AS lot_ids
      FROM public.bid_lots
     WHERE remaining_amount > 0
       AND notified_1d_at IS NULL
       AND expires_at BETWEEN now() + interval '12 hours' AND now() + interval '1 day 12 hours'
     GROUP BY user_id
  ),
  ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT user_id, 'bid_expiration_warning',
           'Seus lances expiram amanhã!',
           total || ' lances vão expirar em ' || to_char(earliest, 'DD/MM/YYYY HH24:MI') || '. Não perca!',
           jsonb_build_object('amount', total, 'expires_at', earliest, 'window', '1d')
      FROM agg
    RETURNING 1
  ),
  upd AS (
    UPDATE public.bid_lots SET notified_1d_at = now()
     WHERE id IN (SELECT unnest(lot_ids) FROM agg)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count_1 FROM ins;

  RETURN QUERY VALUES ('7d', v_count_7), ('1d', v_count_1);
END;
$$;

-- ============================================================
-- MIGRAÇÃO: cria um lote por usuário com saldo > 0, expira em 30d
-- ============================================================
INSERT INTO public.bid_lots (user_id, source, initial_amount, remaining_amount, expires_at)
SELECT p.user_id, 'migration', p.bids_balance, p.bids_balance, now() + interval '30 days'
  FROM public.profiles p
 WHERE COALESCE(p.bids_balance, 0) > 0
   AND COALESCE(p.is_bot, false) = false
   AND NOT EXISTS (SELECT 1 FROM public.bid_lots l WHERE l.user_id = p.user_id);
