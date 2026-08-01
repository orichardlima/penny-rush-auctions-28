
CREATE OR REPLACE FUNCTION public.expansion_normalize_plan_name(_plan_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE UPPER(TRIM(COALESCE(_plan_name, '')))
    WHEN 'START'     THEN 'START'
    WHEN 'INICIAL'   THEN 'START'
    WHEN 'PRO'       THEN 'PRO'
    WHEN 'ELITE'     THEN 'ELITE'
    WHEN 'MASTER'    THEN 'MASTER'
    WHEN 'LEGEND'    THEN 'LEGEND'
    WHEN 'LENDA'     THEN 'LEGEND'
    WHEN 'DIAMOND'   THEN 'DIAMOND'
    WHEN 'DIAMANTE'  THEN 'DIAMOND'
    WHEN 'FOUNDER'   THEN 'FOUNDER'
    WHEN 'FUNDADOR'  THEN 'FOUNDER'
    WHEN 'TEST'      THEN 'TEST'
    WHEN 'TESTE'     THEN 'TEST'
    ELSE 'UNKNOWN'
  END
$$;

CREATE OR REPLACE FUNCTION public.expansion_plan_setting_value(_setting_key text, _plan_name text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT MAX((kv.value)::numeric)
    FROM public.system_settings s
    CROSS JOIN LATERAL jsonb_each_text(NULLIF(BTRIM(s.setting_value), '')::jsonb) AS kv(key, value)
   WHERE s.setting_key = _setting_key
     AND public.expansion_normalize_plan_name(_plan_name) <> 'UNKNOWN'
     AND public.expansion_normalize_plan_name(kv.key) = public.expansion_normalize_plan_name(_plan_name)
$$;

CREATE OR REPLACE FUNCTION public.expansion_plan_points_for(_plan_name text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.expansion_plan_setting_value('expansion_plan_points', _plan_name), 0)
$$;

CREATE OR REPLACE FUNCTION public.expansion_weekly_cap_for(_plan_name text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.expansion_plan_setting_value('expansion_weekly_caps', _plan_name), 0)
$$;

DROP VIEW IF EXISTS public.expansion_plan_name_alerts;
CREATE VIEW public.expansion_plan_name_alerts
WITH (security_invoker = true) AS
WITH raw AS (
  SELECT 'partner_contracts'::text AS source_table, 'plan_name'::text AS source_column,
         MIN(id::text) AS sample_record_id, plan_name AS original_value, COUNT(*)::bigint AS occurrences
    FROM public.partner_contracts GROUP BY 1,2,4
  UNION ALL
  SELECT 'expansion_points_ledger', 'plan_name', MIN(id::text), plan_name, COUNT(*)
    FROM public.expansion_points_ledger GROUP BY 1,2,4
  UNION ALL
  SELECT 'partner_plans', 'name', MIN(id::text), name, COUNT(*)
    FROM public.partner_plans GROUP BY 1,2,4
  UNION ALL
  SELECT 'system_settings', 'expansion_plan_points', 'expansion_plan_points', kv.key, 1::bigint
    FROM public.system_settings s
    CROSS JOIN LATERAL jsonb_each_text(NULLIF(BTRIM(s.setting_value), '')::jsonb) kv
   WHERE s.setting_key = 'expansion_plan_points'
  UNION ALL
  SELECT 'system_settings', 'expansion_weekly_caps', 'expansion_weekly_caps', kv.key, 1::bigint
    FROM public.system_settings s
    CROSS JOIN LATERAL jsonb_each_text(NULLIF(BTRIM(s.setting_value), '')::jsonb) kv
   WHERE s.setting_key = 'expansion_weekly_caps'
)
SELECT r.source_table,
       r.source_column,
       r.sample_record_id,
       r.original_value,
       public.expansion_normalize_plan_name(r.original_value) AS normalized_value,
       r.occurrences,
       CASE
         WHEN public.expansion_normalize_plan_name(r.original_value) = 'UNKNOWN' THEN 'HIGH'
         WHEN r.original_value IS DISTINCT FROM public.expansion_normalize_plan_name(r.original_value) THEN 'MEDIUM'
         ELSE 'INFO'
       END AS severity,
       CASE
         WHEN public.expansion_normalize_plan_name(r.original_value) = 'UNKNOWN'
           THEN 'Grafia nao reconhecida: sem pontos, teto, meta ou regra de carreira. Revisar cadastro.'
         WHEN r.original_value IS DISTINCT FROM public.expansion_normalize_plan_name(r.original_value)
           THEN 'Alias reconhecido; padronizar grafia futuramente. Consultas devem usar expansion_normalize_plan_name.'
         ELSE 'Grafia canonica; nenhuma acao necessaria.'
       END AS recommendation
  FROM raw r
 WHERE public.is_admin_user(auth.uid());

DROP VIEW IF EXISTS public.expansion_career_ledger_events;
CREATE VIEW public.expansion_career_ledger_events
WITH (security_invoker = true) AS
WITH cfg AS (
  SELECT public.expansion_effective_cutoff() AS cutoff_at,
         COALESCE((SELECT NULLIF(BTRIM(setting_value), '')::jsonb
                     FROM public.system_settings
                    WHERE setting_key = 'expansion_prelaunch_authorized_ledger_ids'), '[]'::jsonb) AS authorized_ids
)
SELECT l.id AS ledger_id,
       l.user_id,
       l.contract_id,
       l.plan_name AS plan_name_original,
       public.expansion_normalize_plan_name(l.plan_name) AS plan_name_canonical,
       l.points::numeric AS points,
       l.source,
       l.source_ref,
       l.status,
       l.reverses_id,
       l.created_at,
       cfg.cutoff_at,
       CASE
         WHEN l.reverses_id IS NOT NULL THEN 'REVERSAL'
         WHEN l.status <> 'CONFIRMED' THEN 'INVALID'
         WHEN COALESCE(l.points, 0) <= 0 THEN 'INVALID'
         WHEN c.is_demo IS TRUE THEN 'INVALID'
         WHEN cfg.cutoff_at IS NOT NULL AND l.created_at < cfg.cutoff_at
              AND cfg.authorized_ids ? l.id::text THEN 'PRELAUNCH_AUTHORIZED'
         WHEN cfg.cutoff_at IS NOT NULL AND l.created_at < cfg.cutoff_at THEN 'PRELAUNCH_UNAUTHORIZED'
         ELSE 'OFFICIAL'
       END AS classification,
       (l.reverses_id IS NULL AND l.status = 'CONFIRMED' AND COALESCE(l.points,0) > 0
        AND c.is_demo IS NOT TRUE
        AND (cfg.cutoff_at IS NULL OR l.created_at >= cfg.cutoff_at OR cfg.authorized_ids ? l.id::text)) AS counts_as_career_gross,
       EXISTS (SELECT 1 FROM public.expansion_points_ledger r WHERE r.reverses_id = l.id) AS has_reversal_line,
       CASE
         WHEN l.reverses_id IS NOT NULL THEN 'Linha formal de reversao; nao soma bruto positivo.'
         WHEN l.status <> 'CONFIRMED' THEN 'Status nao confirmado; fora da carreira.'
         WHEN COALESCE(l.points,0) <= 0 THEN 'Pontos nao positivos; fora da carreira.'
         WHEN c.is_demo IS TRUE THEN 'Contrato demo como origem; fora da carreira.'
         WHEN cfg.cutoff_at IS NOT NULL AND l.created_at < cfg.cutoff_at
              AND cfg.authorized_ids ? l.id::text THEN 'Pre-lancamento autorizado; permanece na carreira.'
         WHEN cfg.cutoff_at IS NOT NULL AND l.created_at < cfg.cutoff_at
              THEN 'Pre-lancamento sem autorizacao individual; exige revisao administrativa.'
         ELSE 'Movimento oficial valido.'
       END AS recommendation
  FROM public.expansion_points_ledger l
  CROSS JOIN cfg
  LEFT JOIN public.partner_contracts c ON c.id = l.contract_id
 WHERE l.user_id = auth.uid() OR public.is_admin_user(auth.uid());

REVOKE ALL ON FUNCTION public.expansion_plan_setting_value(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_plan_points_for(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_weekly_cap_for(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expansion_normalize_plan_name(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expansion_plan_setting_value(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expansion_plan_points_for(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expansion_weekly_cap_for(text) TO authenticated, service_role;
REVOKE ALL ON public.expansion_plan_name_alerts FROM PUBLIC;
REVOKE ALL ON public.expansion_career_ledger_events FROM PUBLIC;
GRANT SELECT ON public.expansion_plan_name_alerts TO authenticated, service_role;
GRANT SELECT ON public.expansion_career_ledger_events TO authenticated, service_role;
