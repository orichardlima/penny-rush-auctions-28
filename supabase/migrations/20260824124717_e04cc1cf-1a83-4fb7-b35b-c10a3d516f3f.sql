CREATE OR REPLACE FUNCTION public.partner_get_withdrawal_rules()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      COALESCE((SELECT setting_value::numeric FROM system_settings WHERE setting_key='withdrawal_fee_percentage'),0) AS fee_pct,
      COALESCE((SELECT setting_value FROM system_settings WHERE setting_key='withdrawal_zero_fee_last_monday'),'false') = 'true' AS zero_fee_enabled,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today_local
  ), calc AS (
    SELECT
      base.*,
      -- última segunda-feira do mês corrente (local)
      (date_trunc('month', today_local)::date + interval '1 month' - interval '1 day')::date
        - ((EXTRACT(DOW FROM (date_trunc('month', today_local)::date + interval '1 month' - interval '1 day')::date)::int + 6) % 7) AS last_monday
    FROM base
  )
  SELECT jsonb_build_object(
    'enabled', COALESCE((SELECT setting_value FROM system_settings WHERE setting_key='withdrawals_enabled'),'true') = 'true',
    'allowed_days', COALESCE((SELECT setting_value FROM system_settings WHERE setting_key='withdrawal_allowed_days'),'1'),
    'start_hour', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_start_hour'),8),
    'end_hour', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_end_hour'),18),
    'fee_mode', 'percentage_deducted_from_requested',
    'fee_percentage', CASE WHEN calc.zero_fee_enabled AND calc.today_local = calc.last_monday THEN 0 ELSE calc.fee_pct END,
    'zero_fee_day', (calc.zero_fee_enabled AND calc.today_local = calc.last_monday),
    'min_amount', COALESCE((SELECT setting_value::numeric FROM system_settings WHERE setting_key='partner_min_withdrawal'),0),
    'max_amount', COALESCE((SELECT setting_value::numeric FROM system_settings WHERE setting_key='partner_max_withdrawal'),0),
    'min_interval_hours', COALESCE((SELECT setting_value::numeric FROM system_settings WHERE setting_key='withdrawal_min_interval_hours'),0),
    'max_requests', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_max_requests_per_period'),0),
    'max_requests_period_days', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_max_requests_period_days'),7),
    'analysis_days', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_analysis_days'),0),
    'payment_days', COALESCE((SELECT setting_value::int FROM system_settings WHERE setting_key='withdrawal_payment_days'),0),
    'captured_at', now()
  ) FROM calc;
$function$;