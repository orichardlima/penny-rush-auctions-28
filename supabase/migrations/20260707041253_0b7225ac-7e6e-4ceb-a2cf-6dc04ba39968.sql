
-- ============================================================================
-- FASE 1A — CENTRAL DE PERFORMANCE (INFRAESTRUTURA + BACKFILL, MODO RELATÓRIO)
-- Nenhuma alteração em: auctions, bids, orders, partner_payouts, partner_withdrawals,
-- fury_vault_*, binary_*, partner_contracts (só leitura), affiliates (só leitura + trigger),
-- affiliate_commissions, affiliate_referrals, partner_binary_positions.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1. TABELAS
-- ------------------------------------------------------------------

-- 1.1 performance_settings
CREATE TABLE public.performance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  value_type text NOT NULL DEFAULT 'string' CHECK (value_type IN ('string','number','boolean','json')),
  description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.performance_settings TO authenticated;
GRANT ALL ON public.performance_settings TO service_role;
ALTER TABLE public.performance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_settings_admin_read ON public.performance_settings
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- 1.2 referral_links
CREATE TABLE public.referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL,
  referral_code text NOT NULL UNIQUE,
  campaign_slug text,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'affiliate_mirror'
    CHECK (source IN ('affiliate_mirror','partner_performance_only','manual')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_links_partner ON public.referral_links(partner_user_id);
CREATE INDEX idx_referral_links_active ON public.referral_links(is_active) WHERE is_active = true;
GRANT SELECT ON public.referral_links TO authenticated;
GRANT ALL ON public.referral_links TO service_role;
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY refl_owner_read ON public.referral_links
  FOR SELECT TO authenticated
  USING (partner_user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 1.3 tracking_events
CREATE TABLE public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'click','qualified_click','signup','purchase_approved',
    'partner_plan_approved','payment_refunded','chargeback',
    'self_click','self_conversion','invalid_referral','inactive_link'
  )),
  partner_user_id uuid,
  referral_code text,
  visitor_id text,
  session_id text,
  ip_hash text,
  ua_hash text,
  referrer text,
  landing_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  is_qualified boolean NOT NULL DEFAULT false,
  is_suspicious boolean NOT NULL DEFAULT false,
  fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracking_events_partner ON public.tracking_events(partner_user_id, created_at DESC);
CREATE INDEX idx_tracking_events_visitor ON public.tracking_events(visitor_id, created_at DESC);
CREATE INDEX idx_tracking_events_code ON public.tracking_events(referral_code, created_at DESC);
CREATE INDEX idx_tracking_events_type_date ON public.tracking_events(event_type, created_at DESC);
GRANT SELECT ON public.tracking_events TO authenticated;
GRANT ALL ON public.tracking_events TO service_role;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY te_owner_read ON public.tracking_events
  FOR SELECT TO authenticated
  USING (partner_user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 1.4 attribution_events (idempotente)
CREATE TABLE public.attribution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL,
  conversion_type text NOT NULL CHECK (conversion_type IN (
    'signup','purchase_approved','partner_plan_approved'
  )),
  conversion_id text NOT NULL,
  referral_code text,
  source_click_event_id uuid REFERENCES public.tracking_events(id),
  points_awarded numeric NOT NULL DEFAULT 0,
  reversed boolean NOT NULL DEFAULT false,
  reversed_at timestamptz,
  reversed_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversion_type, conversion_id)
);
CREATE INDEX idx_attr_partner ON public.attribution_events(partner_user_id, created_at DESC);
GRANT SELECT ON public.attribution_events TO authenticated;
GRANT ALL ON public.attribution_events TO service_role;
ALTER TABLE public.attribution_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ae_owner_read ON public.attribution_events
  FOR SELECT TO authenticated
  USING (partner_user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 1.5 partner_weekly_scores
CREATE TABLE public.partner_weekly_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  total_points numeric NOT NULL DEFAULT 0,
  click_points numeric NOT NULL DEFAULT 0,
  conversion_points numeric NOT NULL DEFAULT 0,
  active_days integer NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_user_id, week_start)
);
CREATE INDEX idx_pws_week ON public.partner_weekly_scores(week_start DESC);
GRANT SELECT ON public.partner_weekly_scores TO authenticated;
GRANT ALL ON public.partner_weekly_scores TO service_role;
ALTER TABLE public.partner_weekly_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY pws_owner_read ON public.partner_weekly_scores
  FOR SELECT TO authenticated
  USING (partner_user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 1.6 partner_weekly_eligibility
CREATE TABLE public.partner_weekly_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  status text NOT NULL CHECK (status IN (
    'not_eligible','partial','eligible','auto_qualified','blocked_by_fraud'
  )),
  percentage numeric NOT NULL DEFAULT 0,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_user_id, week_start)
);
GRANT SELECT ON public.partner_weekly_eligibility TO authenticated;
GRANT ALL ON public.partner_weekly_eligibility TO service_role;
ALTER TABLE public.partner_weekly_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY pwe_owner_read ON public.partner_weekly_eligibility
  FOR SELECT TO authenticated
  USING (partner_user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 1.7 anti_fraud_flags
CREATE TABLE public.anti_fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid,
  flag_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  related_event_id uuid REFERENCES public.tracking_events(id),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.anti_fraud_flags TO authenticated;
GRANT ALL ON public.anti_fraud_flags TO service_role;
ALTER TABLE public.anti_fraud_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY aff_admin_read ON public.anti_fraud_flags
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- 1.8 performance_audit_logs
CREATE TABLE public.performance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_user_id uuid,
  target_partner_user_id uuid,
  entity text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pal_created ON public.performance_audit_logs(created_at DESC);
GRANT SELECT ON public.performance_audit_logs TO authenticated;
GRANT ALL ON public.performance_audit_logs TO service_role;
ALTER TABLE public.performance_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pal_admin_read ON public.performance_audit_logs
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- 1.9 performance_backfill_issues
CREATE TABLE public.performance_backfill_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_type text NOT NULL,
  referral_code text,
  affected_user_ids uuid[],
  action_taken text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_manual_fix boolean NOT NULL DEFAULT true,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.performance_backfill_issues TO authenticated;
GRANT ALL ON public.performance_backfill_issues TO service_role;
ALTER TABLE public.performance_backfill_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY pbi_admin_read ON public.performance_backfill_issues
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- ------------------------------------------------------------------
-- 2. TRIGGERS updated_at
-- ------------------------------------------------------------------
CREATE TRIGGER trg_perf_settings_updated BEFORE UPDATE ON public.performance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_referral_links_updated BEFORE UPDATE ON public.referral_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pws_updated BEFORE UPDATE ON public.partner_weekly_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pwe_updated BEFORE UPDATE ON public.partner_weekly_eligibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_aff_updated BEFORE UPDATE ON public.anti_fraud_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------
-- 3. RPCs
-- ------------------------------------------------------------------

-- 3.1 track_click (service_role only) — chamada pela edge track-referral
CREATE OR REPLACE FUNCTION public.track_click(
  p_referral_code text,
  p_visitor_id text,
  p_session_id text,
  p_ip_hash text,
  p_ua_hash text,
  p_referrer text,
  p_landing_url text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_content text,
  p_utm_term text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link record;
  v_dedupe_hours int;
  v_dupe boolean;
  v_event_type text;
  v_is_qualified boolean := false;
  v_flags jsonb := '[]'::jsonb;
  v_metadata jsonb := coalesce(p_metadata,'{}'::jsonb);
  v_partner uuid;
  v_event_id uuid;
BEGIN
  SELECT (setting_value)::int INTO v_dedupe_hours
  FROM performance_settings WHERE setting_key='click_dedupe_hours';
  IF v_dedupe_hours IS NULL THEN v_dedupe_hours := 6; END IF;

  SELECT * INTO v_link FROM referral_links WHERE referral_code = p_referral_code LIMIT 1;

  IF v_link IS NULL THEN
    v_event_type := 'invalid_referral';
    v_flags := jsonb_build_array('invalid_referral');
    v_metadata := v_metadata || jsonb_build_object('attempted_code', left(coalesce(p_referral_code,''),64));
    v_partner := NULL;
  ELSIF NOT v_link.is_active THEN
    v_event_type := 'inactive_link';
    v_flags := jsonb_build_array('inactive_link');
    v_metadata := v_metadata || jsonb_build_object('inactive_since', v_link.updated_at);
    v_partner := v_link.partner_user_id;
  ELSE
    -- self click?
    IF v_metadata ? 'auth_user_id' AND (v_metadata->>'auth_user_id')::uuid = v_link.partner_user_id THEN
      v_event_type := 'self_click';
      v_flags := jsonb_build_array('self_click');
      v_partner := v_link.partner_user_id;
    ELSE
      -- dedupe
      SELECT EXISTS (
        SELECT 1 FROM tracking_events
        WHERE visitor_id = p_visitor_id
          AND referral_code = p_referral_code
          AND event_type IN ('click','qualified_click')
          AND created_at > now() - (v_dedupe_hours || ' hours')::interval
      ) INTO v_dupe;
      IF v_dupe THEN
        v_event_type := 'click';
        v_flags := jsonb_build_array('dedupe_hit');
        v_is_qualified := false;
      ELSE
        v_event_type := 'qualified_click';
        v_is_qualified := true;
      END IF;
      v_partner := v_link.partner_user_id;
    END IF;
  END IF;

  INSERT INTO tracking_events(
    event_type, partner_user_id, referral_code, visitor_id, session_id,
    ip_hash, ua_hash, referrer, landing_url,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    is_qualified, is_suspicious, fraud_flags, metadata
  ) VALUES (
    v_event_type, v_partner,
    CASE WHEN v_link IS NULL THEN NULL ELSE p_referral_code END,
    p_visitor_id, p_session_id,
    p_ip_hash, p_ua_hash, left(coalesce(p_referrer,''),500), left(coalesce(p_landing_url,''),500),
    left(coalesce(p_utm_source,''),100), left(coalesce(p_utm_medium,''),100),
    left(coalesce(p_utm_campaign,''),100), left(coalesce(p_utm_content,''),100),
    left(coalesce(p_utm_term,''),100),
    v_is_qualified,
    (v_event_type IN ('invalid_referral','inactive_link','self_click')),
    v_flags, v_metadata
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'event_type', v_event_type,
    'is_qualified', v_is_qualified,
    'partner_user_id', v_partner
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO performance_audit_logs(action, error_message, metadata)
  VALUES ('track_click_error', SQLERRM, jsonb_build_object('code', p_referral_code));
  RETURN jsonb_build_object('ok', false, 'reason','internal_error');
END;
$$;
REVOKE ALL ON FUNCTION public.track_click(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_click(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) TO service_role;

-- 3.2 attribute_conversion (service_role only) — idempotente
CREATE OR REPLACE FUNCTION public.attribute_conversion(
  p_conversion_type text,
  p_conversion_id text,
  p_user_id uuid,
  p_visitor_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_days int;
  v_click record;
  v_points numeric := 0;
  v_setting_key text;
  v_partner uuid;
  v_result_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM attribution_events
             WHERE conversion_type = p_conversion_type AND conversion_id = p_conversion_id) THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true);
  END IF;

  SELECT (setting_value)::int INTO v_window_days
  FROM performance_settings WHERE setting_key='attribution_window_days';
  IF v_window_days IS NULL THEN v_window_days := 7; END IF;

  -- last-click resolution
  SELECT te.* INTO v_click
  FROM tracking_events te
  WHERE te.event_type = 'qualified_click'
    AND te.created_at > now() - (v_window_days || ' days')::interval
    AND (
      (p_visitor_id IS NOT NULL AND te.visitor_id = p_visitor_id)
    )
  ORDER BY te.created_at DESC
  LIMIT 1;

  IF v_click IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason','no_matching_click');
  END IF;

  v_partner := v_click.partner_user_id;

  -- self-conversion guard
  IF v_partner = p_user_id THEN
    INSERT INTO tracking_events(event_type, partner_user_id, referral_code, visitor_id, is_suspicious, fraud_flags, metadata)
    VALUES ('self_conversion', v_partner, v_click.referral_code, p_visitor_id, true,
            jsonb_build_array('self_conversion'), jsonb_build_object('conversion_type',p_conversion_type,'conversion_id',p_conversion_id));
    RETURN jsonb_build_object('ok', false, 'reason','self_conversion');
  END IF;

  v_setting_key := CASE p_conversion_type
    WHEN 'signup' THEN 'points_signup'
    WHEN 'purchase_approved' THEN 'points_purchase_approved'
    WHEN 'partner_plan_approved' THEN 'points_partner_plan_approved'
  END;

  SELECT (setting_value)::numeric INTO v_points
  FROM performance_settings WHERE setting_key = v_setting_key;
  IF v_points IS NULL THEN v_points := 0; END IF;

  INSERT INTO attribution_events(
    partner_user_id, conversion_type, conversion_id, referral_code,
    source_click_event_id, points_awarded, metadata
  ) VALUES (
    v_partner, p_conversion_type, p_conversion_id, v_click.referral_code,
    v_click.id, v_points, coalesce(p_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_result_id;

  RETURN jsonb_build_object('ok', true, 'attribution_id', v_result_id, 'points', v_points, 'partner_user_id', v_partner);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', true, 'idempotent', true);
WHEN OTHERS THEN
  INSERT INTO performance_audit_logs(action, error_message, metadata)
  VALUES ('attribute_conversion_error', SQLERRM,
          jsonb_build_object('type',p_conversion_type,'id',p_conversion_id));
  RETURN jsonb_build_object('ok', false, 'reason','internal_error');
END;
$$;
REVOKE ALL ON FUNCTION public.attribute_conversion(text,text,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attribute_conversion(text,text,uuid,text,jsonb) TO service_role;

-- 3.3 reverse_performance_points
CREATE OR REPLACE FUNCTION public.reverse_performance_points(
  p_conversion_type text,
  p_conversion_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE attribution_events
  SET reversed = true, reversed_at = now(), reversed_reason = p_reason
  WHERE conversion_type = p_conversion_type
    AND conversion_id = p_conversion_id
    AND reversed = false;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'reversed_count', v_updated);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO performance_audit_logs(action, error_message, metadata)
  VALUES ('reverse_points_error', SQLERRM,
          jsonb_build_object('type',p_conversion_type,'id',p_conversion_id));
  RETURN jsonb_build_object('ok', false, 'reason','internal_error');
END;
$$;
REVOKE ALL ON FUNCTION public.reverse_performance_points(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_performance_points(text,text,text) TO service_role;

-- 3.4 calculate_partner_weekly_score
CREATE OR REPLACE FUNCTION public.calculate_partner_weekly_score(
  p_partner_user_id uuid,
  p_week_start date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_week_end date := p_week_start + 6;
  v_click_pts numeric := 0;
  v_conv_pts numeric := 0;
  v_pt_click numeric;
  v_max_day int;
  v_max_week int;
  v_days int := 0;
  v_min_pts_active numeric;
  v_weekly_req numeric;
  v_partial_req numeric;
  v_min_active_days int;
  v_status text;
  v_pct numeric;
BEGIN
  SELECT (setting_value)::numeric INTO v_pt_click FROM performance_settings WHERE setting_key='points_qualified_click';
  SELECT (setting_value)::int INTO v_max_day FROM performance_settings WHERE setting_key='max_click_points_per_day';
  SELECT (setting_value)::int INTO v_max_week FROM performance_settings WHERE setting_key='max_click_points_per_week';
  SELECT (setting_value)::numeric INTO v_min_pts_active FROM performance_settings WHERE setting_key='min_points_for_active_day';
  SELECT (setting_value)::numeric INTO v_weekly_req FROM performance_settings WHERE setting_key='weekly_points_required';
  SELECT (setting_value)::numeric INTO v_partial_req FROM performance_settings WHERE setting_key='partial_points_required';
  SELECT (setting_value)::int INTO v_min_active_days FROM performance_settings WHERE setting_key='min_active_days';

  -- click points capped per day then per week
  WITH per_day AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'America/Bahia')::date AS d,
           LEAST(count(*) * coalesce(v_pt_click,0.2), coalesce(v_max_day,4)::numeric) AS pts
    FROM tracking_events
    WHERE partner_user_id = p_partner_user_id
      AND event_type = 'qualified_click'
      AND created_at >= p_week_start
      AND created_at < (v_week_end + 1)
    GROUP BY 1
  )
  SELECT LEAST(coalesce(sum(pts),0), coalesce(v_max_week,10)::numeric) INTO v_click_pts FROM per_day;

  SELECT coalesce(sum(points_awarded),0) INTO v_conv_pts
  FROM attribution_events
  WHERE partner_user_id = p_partner_user_id
    AND reversed = false
    AND created_at >= p_week_start
    AND created_at < (v_week_end + 1);

  WITH per_day AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'America/Bahia')::date AS d,
           count(*) FILTER (WHERE event_type='qualified_click') AS clicks,
           count(*) FILTER (WHERE event_type IN ('qualified_click')) AS acts
    FROM tracking_events
    WHERE partner_user_id = p_partner_user_id
      AND created_at >= p_week_start
      AND created_at < (v_week_end + 1)
    GROUP BY 1
  )
  SELECT count(*) INTO v_days FROM per_day WHERE clicks >= 1;

  v_pct := CASE WHEN coalesce(v_weekly_req,20) > 0 THEN LEAST(100, ((v_click_pts+v_conv_pts) / v_weekly_req) * 100) ELSE 0 END;

  v_status := CASE
    WHEN (v_click_pts + v_conv_pts) >= coalesce(v_weekly_req,20)
         AND v_days >= coalesce(v_min_active_days,3) THEN 'eligible'
    WHEN (v_click_pts + v_conv_pts) >= coalesce(v_partial_req,10) THEN 'partial'
    ELSE 'not_eligible'
  END;

  INSERT INTO partner_weekly_scores(
    partner_user_id, week_start, week_end, total_points, click_points, conversion_points,
    active_days, breakdown, calculated_at
  ) VALUES (
    p_partner_user_id, p_week_start, v_week_end,
    v_click_pts + v_conv_pts, v_click_pts, v_conv_pts, v_days,
    jsonb_build_object('click_pts', v_click_pts, 'conv_pts', v_conv_pts, 'days', v_days),
    now()
  )
  ON CONFLICT (partner_user_id, week_start) DO UPDATE
    SET total_points = EXCLUDED.total_points,
        click_points = EXCLUDED.click_points,
        conversion_points = EXCLUDED.conversion_points,
        active_days = EXCLUDED.active_days,
        breakdown = EXCLUDED.breakdown,
        calculated_at = now();

  INSERT INTO partner_weekly_eligibility(
    partner_user_id, week_start, week_end, status, percentage, reason, calculated_at
  ) VALUES (
    p_partner_user_id, p_week_start, v_week_end, v_status, v_pct,
    'auto_calculated', now()
  )
  ON CONFLICT (partner_user_id, week_start) DO UPDATE
    SET status = EXCLUDED.status,
        percentage = EXCLUDED.percentage,
        calculated_at = now();

  RETURN jsonb_build_object('ok', true, 'total_points', v_click_pts+v_conv_pts,
                            'status', v_status, 'active_days', v_days);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO performance_audit_logs(action, target_partner_user_id, error_message)
  VALUES ('calc_week_error', p_partner_user_id, SQLERRM);
  RETURN jsonb_build_object('ok', false, 'reason','internal_error');
END;
$$;
REVOKE ALL ON FUNCTION public.calculate_partner_weekly_score(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_partner_weekly_score(uuid,date) TO service_role;

-- 3.5 calculate_all_partner_weekly_scores
CREATE OR REPLACE FUNCTION public.calculate_all_partner_weekly_scores(p_week_start date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT partner_user_id FROM referral_links WHERE is_active = true
  LOOP
    PERFORM public.calculate_partner_weekly_score(r.partner_user_id, p_week_start);
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'processed', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.calculate_all_partner_weekly_scores(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_all_partner_weekly_scores(date) TO service_role;

-- 3.6 admin_recalculate_week (admin)
CREATE OR REPLACE FUNCTION public.admin_recalculate_week(p_week_start date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  INSERT INTO performance_audit_logs(action, actor_user_id, metadata)
  VALUES ('admin_recalculate_week', auth.uid(), jsonb_build_object('week_start', p_week_start));
  RETURN public.calculate_all_partner_weekly_scores(p_week_start);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_recalculate_week(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recalculate_week(date) TO authenticated;

-- 3.7 update_performance_setting (admin)
CREATE OR REPLACE FUNCTION public.update_performance_setting(
  p_key text, p_value text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_before text;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  SELECT setting_value INTO v_before FROM performance_settings WHERE setting_key = p_key;
  UPDATE performance_settings SET setting_value = p_value, updated_by = auth.uid(), updated_at = now()
   WHERE setting_key = p_key;
  INSERT INTO performance_audit_logs(action, actor_user_id, entity, entity_id, before_data, after_data)
  VALUES ('update_perf_setting', auth.uid(), 'performance_settings', p_key,
          jsonb_build_object('value', v_before), jsonb_build_object('value', p_value));
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.update_performance_setting(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_performance_setting(text,text) TO authenticated;

-- 3.8 get_partner_performance_dashboard
CREATE OR REPLACE FUNCTION public.get_partner_performance_dashboard(p_partner_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_week_start date := (date_trunc('week', (now() AT TIME ZONE 'America/Bahia'))::date);
  v_score record;
  v_elig record;
  v_link record;
BEGIN
  IF p_partner_user_id <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_link FROM referral_links WHERE partner_user_id = p_partner_user_id AND campaign_slug IS NULL LIMIT 1;
  SELECT * INTO v_score FROM partner_weekly_scores WHERE partner_user_id = p_partner_user_id AND week_start = v_week_start;
  SELECT * INTO v_elig FROM partner_weekly_eligibility WHERE partner_user_id = p_partner_user_id AND week_start = v_week_start;

  RETURN jsonb_build_object(
    'week_start', v_week_start,
    'link', CASE WHEN v_link IS NULL THEN NULL ELSE
      jsonb_build_object('code', v_link.referral_code, 'is_active', v_link.is_active, 'url', 'https://showdelances.com/r/' || v_link.referral_code)
    END,
    'score', CASE WHEN v_score IS NULL THEN NULL ELSE
      jsonb_build_object('total', v_score.total_points, 'click', v_score.click_points, 'conversion', v_score.conversion_points, 'active_days', v_score.active_days)
    END,
    'eligibility', CASE WHEN v_elig IS NULL THEN NULL ELSE
      jsonb_build_object('status', v_elig.status, 'percentage', v_elig.percentage)
    END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_partner_performance_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_performance_dashboard(uuid) TO authenticated;

-- ------------------------------------------------------------------
-- 4. TRIGGERS de sincronização (afiliados / contratos → referral_links)
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_referral_link_for_affiliate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    INSERT INTO referral_links(partner_user_id, referral_code, is_active, source)
    VALUES (NEW.user_id, NEW.affiliate_code, (NEW.status='active'), 'affiliate_mirror')
    ON CONFLICT (referral_code) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO performance_audit_logs(action, target_partner_user_id, error_message, metadata)
    VALUES ('create_link_on_affiliate_error', NEW.user_id, SQLERRM,
            jsonb_build_object('code', NEW.affiliate_code));
  END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_create_referral_link_on_affiliate
AFTER INSERT ON public.affiliates
FOR EACH ROW EXECUTE FUNCTION public.create_referral_link_for_affiliate();

CREATE OR REPLACE FUNCTION public.sync_referral_link_active_on_affiliate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    UPDATE referral_links
       SET is_active = (NEW.status='active'), updated_at = now()
     WHERE referral_code = NEW.affiliate_code
       AND source = 'affiliate_mirror';
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO performance_audit_logs(action, target_partner_user_id, error_message)
    VALUES ('sync_link_error', NEW.user_id, SQLERRM);
  END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sync_referral_link_on_affiliate_status
AFTER UPDATE OF status ON public.affiliates
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_referral_link_active_on_affiliate();

CREATE OR REPLACE FUNCTION public.ensure_referral_link_for_partner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing text;
  v_code text;
BEGIN
  BEGIN
    -- se já existe qualquer link para este parceiro (mirror ou performance-only), nada a fazer
    SELECT referral_code INTO v_existing FROM referral_links
     WHERE partner_user_id = NEW.user_id AND campaign_slug IS NULL LIMIT 1;
    IF v_existing IS NOT NULL THEN RETURN NEW; END IF;

    -- gerar code único (performance-only), sem criar affiliate
    LOOP
      v_code := 'PF' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM referral_links WHERE referral_code = v_code)
             AND NOT EXISTS (SELECT 1 FROM affiliates WHERE affiliate_code = v_code);
    END LOOP;

    INSERT INTO referral_links(partner_user_id, referral_code, is_active, source)
    VALUES (NEW.user_id, v_code, true, 'partner_performance_only');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO performance_audit_logs(action, target_partner_user_id, error_message)
    VALUES ('ensure_link_partner_error', NEW.user_id, SQLERRM);
  END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ensure_referral_link_on_partner_contract
AFTER UPDATE OF status ON public.partner_contracts
FOR EACH ROW WHEN (NEW.status = 'ACTIVE' AND OLD.status IS DISTINCT FROM 'ACTIVE')
EXECUTE FUNCTION public.ensure_referral_link_for_partner();

-- ------------------------------------------------------------------
-- 5. SEEDS
-- ------------------------------------------------------------------
INSERT INTO public.performance_settings(setting_key, setting_value, value_type, description) VALUES
  ('performance_center_enabled','false','boolean','Master flag da Central de Performance'),
  ('weekly_points_required','20','number','Pontos necessários para 100% da meta semanal'),
  ('partial_points_required','10','number','Pontos para elegibilidade parcial'),
  ('min_active_days','3','number','Mínimo de dias ativos na semana'),
  ('min_points_for_active_day','1','number','Pontos mínimos para contar como dia ativo'),
  ('points_signup','5','number','Pontos por cadastro atribuído'),
  ('points_purchase_approved','8','number','Pontos por compra aprovada'),
  ('points_partner_plan_approved','20','number','Pontos por plano de parceiro aprovado'),
  ('points_qualified_click','0.2','number','Pontos por clique qualificado'),
  ('max_click_points_per_day','4','number','Teto diário de pontos por clique'),
  ('max_click_points_per_week','10','number','Teto semanal de pontos por clique'),
  ('attribution_window_days','7','number','Janela de atribuição last-click em dias'),
  ('click_dedupe_hours','6','number','Janela de dedupe de clique por visitor+code'),
  ('attribution_model','last_click','string','Modelo de atribuição'),
  ('week_timezone','America/Bahia','string','Fuso do fechamento semanal'),
  ('reversal_on_refund','true','boolean','Reverter pontos em refund/chargeback'),
  ('block_self_referral','true','boolean','Bloquear autoindicação')
ON CONFLICT (setting_key) DO NOTHING;

-- ------------------------------------------------------------------
-- 6. BACKFILL
-- ------------------------------------------------------------------
DO $BF$
DECLARE
  v_dup_count int := 0;
  v_invalid_count int := 0;
  r record;
BEGIN
  -- 6.1 duplicidades em affiliate_code (mesmo code em >1 registro)
  FOR r IN
    SELECT affiliate_code, array_agg(user_id) AS users
    FROM affiliates
    WHERE affiliate_code IS NOT NULL
    GROUP BY affiliate_code
    HAVING count(*) > 1
  LOOP
    INSERT INTO performance_backfill_issues(issue_type, referral_code, affected_user_ids, action_taken, details)
    VALUES ('duplicate_code', r.affiliate_code, r.users, 'skipped',
            jsonb_build_object('note','multiple affiliates share same code; only first will be linked'));
    v_dup_count := v_dup_count + 1;
  END LOOP;

  -- 6.2 formato inválido
  FOR r IN
    SELECT affiliate_code, array_agg(user_id) AS users
    FROM affiliates
    WHERE affiliate_code IS NOT NULL
      AND affiliate_code !~ '^[A-Z0-9_-]{4,32}$'
    GROUP BY affiliate_code
  LOOP
    INSERT INTO performance_backfill_issues(issue_type, referral_code, affected_user_ids, action_taken, details)
    VALUES ('invalid_format', r.affiliate_code, r.users, 'flagged_manual',
            jsonb_build_object('expected','^[A-Z0-9_-]{4,32}$'));
    v_invalid_count := v_invalid_count + 1;
  END LOOP;

  -- 6.3 espelho de afiliados existentes
  INSERT INTO referral_links(partner_user_id, referral_code, is_active, source)
  SELECT DISTINCT ON (a.affiliate_code) a.user_id, a.affiliate_code, (a.status='active'), 'affiliate_mirror'
  FROM affiliates a
  WHERE a.affiliate_code IS NOT NULL
    AND a.affiliate_code ~ '^[A-Z0-9_-]{4,32}$'
  ORDER BY a.affiliate_code, a.created_at ASC
  ON CONFLICT (referral_code) DO NOTHING;

  -- 6.4 parceiros ativos sem qualquer link → performance-only
  INSERT INTO referral_links(partner_user_id, referral_code, is_active, source)
  SELECT DISTINCT pc.user_id,
         'PF' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
         true, 'partner_performance_only'
  FROM partner_contracts pc
  WHERE pc.status = 'ACTIVE'
    AND NOT EXISTS (SELECT 1 FROM referral_links rl WHERE rl.partner_user_id = pc.user_id)
    AND NOT EXISTS (SELECT 1 FROM affiliates a WHERE a.user_id = pc.user_id AND a.affiliate_code IS NOT NULL);

  RAISE NOTICE 'backfill: duplicates=% invalid_format=%', v_dup_count, v_invalid_count;
END;
$BF$;

-- ------------------------------------------------------------------
-- 7. Bloquear INSERT/UPDATE/DELETE direto (defesa em profundidade)
-- ------------------------------------------------------------------
-- Todas as tabelas têm apenas policies de SELECT criadas acima; INSERT/UPDATE/DELETE
-- direto por authenticated/anon é negado pela RLS por não haver policy correspondente.
