
-- 1) Nova flag de visibilidade para o parceiro
INSERT INTO public.performance_settings (setting_key, setting_value, value_type, description)
VALUES ('performance_center_partner_visible', 'false', 'boolean', 'Se true, parceiros veem a seção "Minha Performance" dentro da Central de Anúncios. Modo relatório - não impacta repasse.')
ON CONFLICT (setting_key) DO NOTHING;

-- 2) RPC: resumo do parceiro logado para a semana
CREATE OR REPLACE FUNCTION public.get_partner_performance_summary(_week_start date)
RETURNS TABLE (
  referral_code text,
  qualified_clicks bigint,
  suspicious_clicks bigint,
  signups bigint,
  purchases_approved bigint,
  contracts_approved bigint,
  total_points numeric,
  click_points numeric,
  conversion_points numeric,
  active_days integer,
  week_rank integer,
  week_total_partners integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_week_end timestamptz := (_week_start + interval '7 days');
  v_week_start_ts timestamptz := _week_start::timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  RETURN QUERY
  WITH my_code AS (
    SELECT rl.referral_code
    FROM public.referral_links rl
    WHERE rl.partner_user_id = v_uid AND rl.is_active = true
    ORDER BY rl.created_at ASC
    LIMIT 1
  ),
  clicks AS (
    SELECT
      COUNT(*) FILTER (WHERE te.event_type='qualified_click' AND COALESCE(te.is_suspicious,false)=false) AS qualified,
      COUNT(*) FILTER (WHERE te.event_type='qualified_click' AND te.is_suspicious=true) AS suspicious
    FROM public.tracking_events te
    WHERE te.partner_user_id = v_uid
      AND te.created_at >= v_week_start_ts
      AND te.created_at < v_week_end
  ),
  convs AS (
    SELECT
      COUNT(*) FILTER (WHERE ae.conversion_type='signup' AND COALESCE(ae.reversed,false)=false) AS signups,
      COUNT(*) FILTER (WHERE ae.conversion_type='purchase_approved' AND COALESCE(ae.reversed,false)=false) AS purchases,
      COUNT(*) FILTER (WHERE ae.conversion_type IN ('contract_approved','new_partner') AND COALESCE(ae.reversed,false)=false) AS contracts
    FROM public.attribution_events ae
    WHERE ae.partner_user_id = v_uid
      AND ae.created_at >= v_week_start_ts
      AND ae.created_at < v_week_end
  ),
  score AS (
    SELECT pws.total_points, pws.click_points, pws.conversion_points, pws.active_days
    FROM public.partner_weekly_scores pws
    WHERE pws.partner_user_id = v_uid AND pws.week_start = _week_start
    LIMIT 1
  ),
  ranked AS (
    SELECT partner_user_id,
           RANK() OVER (ORDER BY total_points DESC) AS rk,
           COUNT(*) OVER () AS total
    FROM public.partner_weekly_scores
    WHERE week_start = _week_start AND total_points > 0
  ),
  my_rank AS (
    SELECT rk::int AS week_rank, total::int AS week_total_partners
    FROM ranked WHERE partner_user_id = v_uid
    LIMIT 1
  )
  SELECT
    (SELECT referral_code FROM my_code),
    COALESCE(clicks.qualified, 0),
    COALESCE(clicks.suspicious, 0),
    COALESCE(convs.signups, 0),
    COALESCE(convs.purchases, 0),
    COALESCE(convs.contracts, 0),
    COALESCE(score.total_points, 0),
    COALESCE(score.click_points, 0),
    COALESCE(score.conversion_points, 0),
    COALESCE(score.active_days, 0),
    COALESCE((SELECT week_rank FROM my_rank), 0),
    COALESCE((SELECT week_total_partners FROM my_rank), 0)
  FROM clicks, convs
  LEFT JOIN score ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_performance_summary(date) TO authenticated;

-- 3) RPC: histórico de pontos por semana
CREATE OR REPLACE FUNCTION public.get_partner_performance_history(_weeks integer DEFAULT 4)
RETURNS TABLE (
  week_start date,
  total_points numeric,
  click_points numeric,
  conversion_points numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_weeks integer := GREATEST(1, LEAST(COALESCE(_weeks, 4), 26));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  RETURN QUERY
  SELECT pws.week_start, pws.total_points, pws.click_points, pws.conversion_points
  FROM public.partner_weekly_scores pws
  WHERE pws.partner_user_id = v_uid
  ORDER BY pws.week_start DESC
  LIMIT v_weeks;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_performance_history(integer) TO authenticated;
