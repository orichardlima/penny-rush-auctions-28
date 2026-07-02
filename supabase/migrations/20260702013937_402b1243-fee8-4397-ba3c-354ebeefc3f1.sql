
CREATE TABLE IF NOT EXISTS public.auction_scheduled_finalizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  reason text NOT NULL,
  bot_only boolean NOT NULL DEFAULT true,
  scheduled_for timestamptz NOT NULL,
  queued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finalized_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auction_scheduled_finalizations TO authenticated;
GRANT ALL ON public.auction_scheduled_finalizations TO service_role;

ALTER TABLE public.auction_scheduled_finalizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view scheduled finalizations" ON public.auction_scheduled_finalizations;
CREATE POLICY "Admins view scheduled finalizations"
ON public.auction_scheduled_finalizations
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_asf_scheduled_for
  ON public.auction_scheduled_finalizations(scheduled_for);
CREATE UNIQUE INDEX IF NOT EXISTS idx_asf_active_unique
  ON public.auction_scheduled_finalizations(auction_id)
  WHERE finalized_at IS NULL AND cancelled_at IS NULL;

CREATE OR REPLACE FUNCTION public._bot_finalize_auction(
  p_auction_id uuid,
  p_title text,
  p_finish_reason text,
  p_current_time timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bot_user_id uuid;
  v_winner_name text;
  v_winner_city text;
  v_winner_state text;
  v_bot_display text;
  v_name_parts text[];
  v_current_bidders jsonb;
  v_rows integer;
  v_finished_at timestamptz;
BEGIN
  SELECT public.get_random_bot() INTO v_bot_user_id;
  IF v_bot_user_id IS NULL THEN
    RAISE LOG '❌ [BOT-FINALIZE] Nenhum bot disponível para "%"', p_title;
    RETURN;
  END IF;

  SELECT full_name, city, state INTO v_winner_name, v_winner_city, v_winner_state
  FROM profiles WHERE user_id = v_bot_user_id;

  IF v_winner_city IS NOT NULL AND v_winner_state IS NOT NULL THEN
    v_winner_name := v_winner_name || ' - ' || v_winner_city || ', ' || v_winner_state;
  END IF;

  v_name_parts := string_to_array(trim(COALESCE((SELECT full_name FROM profiles WHERE user_id = v_bot_user_id), 'Bot')), ' ');
  IF array_length(v_name_parts, 1) >= 2 THEN
    v_bot_display := v_name_parts[1] || ' ' || v_name_parts[2];
  ELSE
    v_bot_display := v_name_parts[1];
  END IF;

  v_current_bidders := COALESCE((SELECT last_bidders FROM auctions WHERE id = p_auction_id), '[]'::jsonb);
  v_current_bidders := (to_jsonb(v_bot_display) || v_current_bidders);
  IF jsonb_array_length(v_current_bidders) > 3 THEN
    v_current_bidders := (SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY t(elem, ord) ORDER BY ord LIMIT 3) sub);
  END IF;

  v_finished_at := clock_timestamp();

  UPDATE auctions SET
    status = 'finished',
    finished_at = v_finished_at,
    winner_id = v_bot_user_id,
    winner_name = v_winner_name,
    last_bidders = v_current_bidders,
    finish_reason = p_finish_reason,
    scheduled_bot_bid_at = NULL,
    scheduled_bot_band = NULL
  WHERE id = p_auction_id AND status = 'active' AND finished_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    RAISE LOG '🏁 [BOT-FINALIZE] auction=% title="%" reason=% ctx_time=% real_finished_at=% bot=%',
      p_auction_id, p_title, p_finish_reason, p_current_time, v_finished_at, v_winner_name;

    UPDATE public.auction_scheduled_finalizations
    SET finalized_at = v_finished_at,
        updated_at = now()
    WHERE auction_id = p_auction_id
      AND finalized_at IS NULL
      AND cancelled_at IS NULL;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public._schedule_bot_only_finalization(
  p_auction_id uuid,
  p_title text,
  p_reason text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_candidate timestamptz;
  v_attempt integer := 0;
  v_min_sec integer := 180;
  v_max_sec integer := 1500;
  v_collision boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.auction_scheduled_finalizations
    WHERE auction_id = p_auction_id
      AND finalized_at IS NULL
      AND cancelled_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_candidate := v_now + ((v_min_sec + floor(random() * (v_max_sec - v_min_sec + 1)))::text || ' seconds')::interval;

    v_collision := EXISTS (
      SELECT 1 FROM auctions
      WHERE (
        (ends_at IS NOT NULL
          AND date_trunc('minute', ends_at) = date_trunc('minute', v_candidate)
          AND ends_at BETWEEN v_now - interval '3 hours' AND v_now + interval '3 hours')
        OR
        (finished_at IS NOT NULL
          AND date_trunc('minute', finished_at) = date_trunc('minute', v_candidate)
          AND finished_at BETWEEN v_now - interval '3 hours' AND v_now + interval '3 hours')
      )
    ) OR EXISTS (
      SELECT 1 FROM public.auction_scheduled_finalizations
      WHERE finalized_at IS NULL AND cancelled_at IS NULL
        AND date_trunc('minute', scheduled_for) = date_trunc('minute', v_candidate)
    );

    EXIT WHEN NOT v_collision;
    EXIT WHEN v_attempt >= 20;
  END LOOP;

  IF v_collision THEN
    WHILE EXISTS (
      SELECT 1 FROM auctions
      WHERE ends_at IS NOT NULL
        AND date_trunc('minute', ends_at) = date_trunc('minute', v_candidate)
        AND ends_at BETWEEN v_now - interval '3 hours' AND v_now + interval '6 hours'
    ) LOOP
      v_candidate := v_candidate + interval '30 seconds';
    END LOOP;
  END IF;

  INSERT INTO public.auction_scheduled_finalizations (auction_id, reason, bot_only, scheduled_for, notes)
  VALUES (p_auction_id, p_reason, true, v_candidate,
          jsonb_build_object('title', p_title, 'attempts', v_attempt));

  UPDATE auctions SET ends_at = v_candidate WHERE id = p_auction_id;

  RAISE LOG '⏳ [SCHEDULE] auction=% title="%" reason=% scheduled_for=% attempts=%',
    p_auction_id, p_title, p_reason, v_candidate, v_attempt;

  RETURN v_candidate;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bot_protection_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auction RECORD;
  v_seconds_since_last_bid integer;
  v_bot_user_id uuid;
  v_new_price numeric;
  v_current_time timestamptz;
  v_activated integer := 0;
  v_band text;
  v_delay_sec integer;
  v_rand numeric;
  v_scheduled_time timestamptz;
  v_has_scheduled boolean;
BEGIN
  v_current_time := clock_timestamp();

  RAISE LOG '🔄 [BOT-LOOP] Passagem - %', v_current_time;

  UPDATE auctions
  SET status = 'active', time_left = 15, last_bid_at = clock_timestamp(), updated_at = clock_timestamp()
  WHERE status = 'waiting' AND starts_at IS NOT NULL AND starts_at <= clock_timestamp();

  GET DIAGNOSTICS v_activated = ROW_COUNT;
  IF v_activated > 0 THEN
    RAISE LOG '✅ [BOT-LOOP] % leilão(ões) waiting -> active', v_activated;
  END IF;

  FOR v_auction IN
    SELECT id, title, current_price, market_value, company_revenue, revenue_target,
           last_bid_at, bid_increment, ends_at, max_price, status,
           scheduled_bot_bid_at, scheduled_bot_band, last_bot_band,
           predefined_winner_id, predefined_winner_ids, open_win_mode, min_bids_to_qualify
    FROM auctions
    WHERE status = 'active'
  LOOP
    v_seconds_since_last_bid := EXTRACT(EPOCH FROM (v_current_time - v_auction.last_bid_at))::integer;

    IF v_auction.ends_at IS NOT NULL AND clock_timestamp() >= v_auction.ends_at THEN
      PERFORM public._bot_finalize_auction(v_auction.id, v_auction.title, 'time_limit', clock_timestamp());
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.auction_scheduled_finalizations
      WHERE auction_id = v_auction.id AND finalized_at IS NULL AND cancelled_at IS NULL
    ) INTO v_has_scheduled;

    IF v_auction.max_price IS NOT NULL AND v_auction.current_price >= v_auction.max_price THEN
      IF NOT v_has_scheduled THEN
        PERFORM public._schedule_bot_only_finalization(v_auction.id, v_auction.title, 'max_price');
      END IF;
      CONTINUE;
    END IF;

    IF v_auction.company_revenue >= v_auction.revenue_target THEN
      IF NOT v_has_scheduled THEN
        PERFORM public._schedule_bot_only_finalization(v_auction.id, v_auction.title, 'revenue_target');
      END IF;
      CONTINUE;
    END IF;

    IF v_seconds_since_last_bid >= 90 THEN
      IF NOT v_has_scheduled THEN
        RAISE LOG '🚨 [BOT-LOOP] "%" - %s sem lance, enfileirando inactivity_forced', v_auction.title, v_seconds_since_last_bid;
        PERFORM public._schedule_bot_only_finalization(v_auction.id, v_auction.title, 'inactivity_forced');
      END IF;
      CONTINUE;
    END IF;

    IF v_auction.scheduled_bot_bid_at IS NOT NULL THEN
      IF v_current_time >= v_auction.scheduled_bot_bid_at THEN
        IF v_auction.scheduled_bot_bid_at >= v_auction.last_bid_at THEN
          SELECT public.get_random_bot() INTO v_bot_user_id;
          IF v_bot_user_id IS NOT NULL THEN
            v_new_price := v_auction.current_price + COALESCE(v_auction.bid_increment, 0.01);
            INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
            VALUES (v_auction.id, v_bot_user_id, v_new_price, 0);

            UPDATE auctions SET last_bot_band = v_auction.scheduled_bot_band,
              scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
            WHERE id = v_auction.id;

            RAISE LOG '🤖 [BOT-EXEC] "%" | band=% | R$%', v_auction.title, v_auction.scheduled_bot_band, v_new_price;
            CONTINUE;
          END IF;
        ELSE
          UPDATE auctions SET scheduled_bot_bid_at = NULL, scheduled_bot_band = NULL
          WHERE id = v_auction.id;
          RAISE LOG '🗑️ [BOT-STALE] "%" | agendamento obsoleto descartado', v_auction.title;
        END IF;
      END IF;
    END IF;

    IF v_seconds_since_last_bid >= 9
       AND (v_auction.scheduled_bot_bid_at IS NULL
            OR v_auction.scheduled_bot_bid_at > v_current_time + interval '1 second') THEN
      SELECT public.get_random_bot() INTO v_bot_user_id;
      IF v_bot_user_id IS NOT NULL THEN
        v_new_price := v_auction.current_price + COALESCE(v_auction.bid_increment, 0.01);
        INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
        VALUES (v_auction.id, v_bot_user_id, v_new_price, 0);

        UPDATE auctions
        SET last_bot_band = 'panic',
            scheduled_bot_bid_at = NULL,
            scheduled_bot_band = NULL
        WHERE id = v_auction.id;

        RAISE LOG '⚠️ [PANIC-BID] "%" | sec_since_last=% | R$%', v_auction.title, v_seconds_since_last_bid, v_new_price;
        CONTINUE;
      END IF;
    END IF;

    IF v_auction.scheduled_bot_bid_at IS NULL AND v_seconds_since_last_bid >= 2 THEN
      v_rand := random();
      IF v_rand < 0.40 THEN
        v_band := 'early'; v_delay_sec := 2 + floor(random() * 3)::int;
      ELSIF v_rand < 0.75 THEN
        v_band := 'middle'; v_delay_sec := 4 + floor(random() * 3)::int;
      ELSE
        v_band := 'late'; v_delay_sec := 6 + floor(random() * 3)::int;
      END IF;

      IF v_auction.last_bot_band IS NOT NULL AND v_auction.last_bot_band = v_band THEN
        IF v_band = 'early' THEN v_band := 'middle'; v_delay_sec := 5;
        ELSIF v_band = 'middle' THEN v_band := 'late'; v_delay_sec := 7;
        ELSIF v_band = 'late' THEN v_band := 'early'; v_delay_sec := 3;
        END IF;
      END IF;

      v_scheduled_time := v_auction.last_bid_at + (v_delay_sec || ' seconds')::interval;

      UPDATE auctions SET scheduled_bot_bid_at = v_scheduled_time, scheduled_bot_band = v_band
      WHERE id = v_auction.id;

      RAISE LOG '⏰ [BOT-SCHED] "%" | band=% | delay=%s | exec_at=%', v_auction.title, v_band, v_delay_sec, v_scheduled_time;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public._cancel_scheduled_on_real_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_bot boolean;
  v_updated integer;
  v_new_ends timestamptz;
BEGIN
  SELECT COALESCE(is_bot, false) INTO v_is_bot
  FROM public.profiles WHERE user_id = NEW.user_id;

  IF v_is_bot = false THEN
    UPDATE public.auction_scheduled_finalizations
    SET cancelled_at = clock_timestamp(),
        cancel_reason = 'real_bid_received',
        updated_at = now(),
        notes = notes || jsonb_build_object('cancelled_by_bid', NEW.id, 'bidder', NEW.user_id)
    WHERE auction_id = NEW.auction_id
      AND finalized_at IS NULL
      AND cancelled_at IS NULL;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      v_new_ends := clock_timestamp() + interval '5 minutes';
      UPDATE public.auctions
      SET ends_at = v_new_ends
      WHERE id = NEW.auction_id
        AND status = 'active'
        AND finished_at IS NULL;

      RAISE LOG '↩️ [SCHEDULE-CANCEL] auction=% reason=real_bid_received bidder=% new_ends=%',
        NEW.auction_id, NEW.user_id, v_new_ends;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cancel_scheduled_on_real_bid ON public.bids;
CREATE TRIGGER trg_cancel_scheduled_on_real_bid
AFTER INSERT ON public.bids
FOR EACH ROW EXECUTE FUNCTION public._cancel_scheduled_on_real_bid();

CREATE OR REPLACE FUNCTION public.admin_release_stuck_auctions(p_ids uuid[])
RETURNS TABLE(auction_id uuid, new_ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_i integer := 0;
  v_now timestamptz := clock_timestamp();
  v_new_ends timestamptz;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    v_new_ends := v_now
      + ((2 + v_i * 5)::text || ' minutes')::interval
      + ((floor(random() * 120))::text || ' seconds')::interval;

    UPDATE public.auctions
    SET ends_at = v_new_ends,
        updated_at = clock_timestamp()
    WHERE id = v_id AND finished_at IS NULL;

    INSERT INTO public.auction_scheduled_finalizations
      (auction_id, reason, bot_only, scheduled_for, notes)
    VALUES
      (v_id, 'admin_release', false, v_new_ends,
       jsonb_build_object('released_by', auth.uid(), 'batch_index', v_i))
    ON CONFLICT DO NOTHING;

    RAISE LOG '🔧 [ADMIN-RELEASE] auction=% new_ends=% index=%', v_id, v_new_ends, v_i;

    auction_id := v_id;
    new_ends_at := v_new_ends;
    RETURN NEXT;

    v_i := v_i + 1;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public._asf_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_asf_touch ON public.auction_scheduled_finalizations;
CREATE TRIGGER trg_asf_touch BEFORE UPDATE ON public.auction_scheduled_finalizations
FOR EACH ROW EXECUTE FUNCTION public._asf_touch_updated_at();
