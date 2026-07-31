
-- Registro explícito (não hardcoded) dos movimentos pré-lançamento autorizados
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('expansion_prelaunch_authorized_ledger_ids',
        '["0e791786-3c5d-45e5-86d0-1574eef6e6e0"]',
        'Lançamentos do Programa de Expansão anteriores ao início oficial reconhecidos por decisão administrativa como saldo inicial válido.')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;


CREATE OR REPLACE FUNCTION public.expansion_admin_partner_points(_search text DEFAULT NULL, _limit integer DEFAULT 200)
RETURNS TABLE(
  user_id uuid,
  partner_name text,
  teams_count integer,
  points_gross numeric,
  points_reversed numeric,
  points_consumed numeric,
  points_available numeric,
  largest_team_points numeric,
  other_teams_points numeric,
  vqe_estimate numeric,
  bonus_calculated numeric,
  bonus_released_wallet numeric,
  expansion_payout_total numeric,
  wallet_credit_total numeric,
  snapshots_count integer,
  last_period_start date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  RETURN QUERY
  WITH ancestors AS (
    SELECT DISTINCT m.ancestor_user_id AS uid
      FROM public.expansion_team_memberships m
     WHERE m.effective_to IS NULL
  ),
  -- FONTE CANÔNICA ÚNICA de saldo: expansion_team_balances
  -- (expansion_points_ledger CONFIRMED - expansion_team_consumptions)
  bal AS (
    SELECT a.uid,
           COALESCE(b.points_earned,0)::numeric    AS earned,
           COALESCE(b.points_consumed,0)::numeric  AS consumed,
           COALESCE(b.points_available,0)::numeric AS available
      FROM ancestors a
      CROSS JOIN LATERAL public.expansion_team_balances(a.uid, CURRENT_DATE) b
  ),
  agg AS (
    SELECT bal.uid,
           COUNT(*)::int AS teams_count,
           SUM(bal.earned)    AS earned,
           SUM(bal.consumed)  AS consumed,
           SUM(bal.available) AS available,
           COALESCE(MAX(bal.available),0) AS largest,
           SUM(bal.available) - COALESCE(MAX(bal.available),0) AS others
      FROM bal GROUP BY bal.uid
  ),
  rev AS (
    SELECT m.ancestor_user_id AS uid, SUM(ABS(l.points))::numeric AS reversed_points
      FROM public.expansion_team_memberships m
      JOIN public.expansion_points_ledger l ON l.user_id = m.descendant_user_id
     WHERE (l.status = 'REVERSED' OR l.reverses_id IS NOT NULL)
       AND l.created_at >= m.effective_from
       AND (m.effective_to IS NULL OR l.created_at < m.effective_to)
     GROUP BY 1
  ),
  snaps AS (
    SELECT s.user_id AS uid,
           COUNT(*)::int AS snapshots_count,
           SUM(CASE WHEN s.status_official IN ('closed','released') THEN COALESCE(s.final_bonus,0) ELSE 0 END) AS bonus_calculated,
           SUM(CASE WHEN s.status_official = 'released' THEN COALESCE(s.final_bonus,0) ELSE 0 END) AS bonus_released,
           MAX(s.period_start) AS last_period_start
      FROM public.expansion_period_snapshots s
     GROUP BY s.user_id
  ),
  pay AS (
    SELECT s.user_id AS uid, SUM(COALESCE(p.final_amount, p.amount, 0)) AS payout_total
      FROM public.partner_payouts p
      JOIN public.expansion_period_snapshots s ON s.id = p.source_id
     WHERE p.payout_type = 'expansion_bonus'
       AND p.source_type IN ('expansion_period_snapshot','expansion_snapshot')
       AND COALESCE(p.status,'') <> 'CANCELLED'
     GROUP BY 1
  ),
  wal AS (
    SELECT t.wallet_user_id AS uid, SUM(t.amount) AS wallet_total
      FROM public.partner_network_wallet_transactions t
     WHERE t.bonus_type = 'expansion_bonus' AND t.direction = 'credit' AND t.status = 'COMPLETED'
     GROUP BY 1
  )
  SELECT agg.uid,
         COALESCE(pr.full_name, pr.email, agg.uid::text),
         agg.teams_count,
         COALESCE(agg.earned,0),
         COALESCE(rev.reversed_points,0),
         COALESCE(agg.consumed,0),
         COALESCE(agg.available,0),
         agg.largest,
         agg.others,
         LEAST(agg.largest, agg.others),
         COALESCE(snaps.bonus_calculated,0),
         COALESCE(snaps.bonus_released,0),
         COALESCE(pay.payout_total,0),
         COALESCE(wal.wallet_total,0),
         COALESCE(snaps.snapshots_count,0),
         snaps.last_period_start
    FROM agg
    LEFT JOIN public.profiles pr ON pr.id = agg.uid
    LEFT JOIN rev   ON rev.uid   = agg.uid
    LEFT JOIN snaps ON snaps.uid = agg.uid
    LEFT JOIN pay   ON pay.uid   = agg.uid
    LEFT JOIN wal   ON wal.uid   = agg.uid
   WHERE _search IS NULL OR _search = ''
      OR COALESCE(pr.full_name,'') ILIKE '%'||_search||'%'
      OR COALESCE(pr.email,'') ILIKE '%'||_search||'%'
   ORDER BY COALESCE(agg.available,0) DESC
   LIMIT GREATEST(COALESCE(_limit,200), 1);
END;
$function$;


CREATE OR REPLACE FUNCTION public.expansion_admin_integrity_check(_limit integer DEFAULT 300)
RETURNS TABLE(
  severity text,
  code text,
  title text,
  detail text,
  user_id uuid,
  partner_name text,
  period_start date,
  reference text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cut TIMESTAMPTZ;
  v_caps JSONB;
  v_auth JSONB;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT NULLIF(setting_value,'')::timestamptz INTO v_cut
    FROM public.system_settings WHERE setting_key = 'expansion_official_start_at';
  SELECT COALESCE(NULLIF(setting_value,'')::jsonb,'{}'::jsonb) INTO v_caps
    FROM public.system_settings WHERE setting_key = 'expansion_weekly_caps';
  SELECT COALESCE(NULLIF(setting_value,'')::jsonb,'[]'::jsonb) INTO v_auth
    FROM public.system_settings WHERE setting_key = 'expansion_prelaunch_authorized_ledger_ids';
  v_auth := COALESCE(v_auth,'[]'::jsonb);

  RETURN QUERY
  WITH nm AS (SELECT p.id, COALESCE(p.full_name, p.email, p.id::text) AS name FROM public.profiles p),
  c1 AS (
    SELECT 'CRITICAL'::text sev,'SNAPSHOT_DUPLICADO'::text code,
           'Mais de um fechamento para o mesmo parceiro no mesmo período'::text title,
           ('Registros: '||COUNT(*))::text detail, s.user_id, s.period_start, NULL::text ref
      FROM public.expansion_period_snapshots s
     GROUP BY s.user_id, s.period_start HAVING COUNT(*) > 1
  ),
  c2 AS (
    SELECT 'CRITICAL','BONUS_ACIMA_TETO',
           'Bônus calculado acima do teto semanal gravado no fechamento',
           ('Bônus '||s.final_bonus||' > teto '||COALESCE(s.weekly_cap_value,s.weekly_cap)),
           s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
     WHERE COALESCE(s.weekly_cap_value,s.weekly_cap) IS NOT NULL
       AND COALESCE(s.final_bonus,0) > COALESCE(s.weekly_cap_value,s.weekly_cap) + 0.01
  ),
  c3 AS (
    SELECT 'CRITICAL','VQE_ACIMA_DO_PLANO',
           'Volume qualificado pagável acima do máximo permitido pelo plano',
           ('VQE pagável '||s.payable_vqe_points||' acima do limite do plano '||COALESCE(s.plan_name,'—')),
           s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
     WHERE COALESCE(s.bonus_percent,0) > 0
       AND COALESCE(v_caps->>s.plan_name,'')<>''
       AND COALESCE(s.payable_vqe_points,0)
           > ((v_caps->>s.plan_name)::numeric / (s.bonus_percent/100.0)) + 0.01
  ),
  c4 AS (
    SELECT 'CRITICAL','CONSUMO_TOTAL_DIVERGENTE',
           'Consumo total diferente do dobro do volume qualificado pagável',
           ('Consumo '||s.total_points_consumed||' ≠ 2 × '||s.payable_vqe_points),
           s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
     WHERE s.status_official IN ('closed','released')
       AND COALESCE(s.payable_vqe_points,0) > 0
       AND ABS(COALESCE(s.total_points_consumed,0) - 2*COALESCE(s.payable_vqe_points,0)) > 0.01
  ),
  c5 AS (
    SELECT 'CRITICAL','CONSUMO_MAIOR_EQUIPE_DIVERGENTE',
           'Consumo da maior equipe diferente do volume qualificado pagável',
           ('Consumo maior equipe '||COALESCE(x.largest_consumed,0)||' ≠ '||s.payable_vqe_points),
           s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
      JOIN LATERAL (
        SELECT SUM(c.points_consumed) FILTER (WHERE c.role='LARGEST') AS largest_consumed, COUNT(*) AS n
          FROM public.expansion_team_consumptions c WHERE c.snapshot_id = s.id) x ON TRUE
     WHERE s.status_official IN ('closed','released')
       AND COALESCE(s.payable_vqe_points,0) > 0 AND x.n > 0
       AND ABS(COALESCE(x.largest_consumed,0) - COALESCE(s.payable_vqe_points,0)) > 0.01
  ),
  c6 AS (
    SELECT 'CRITICAL','CONSUMO_DEMAIS_DIVERGENTE',
           'Soma do consumo das demais equipes diferente do volume qualificado pagável',
           ('Consumo demais '||COALESCE(x.others_consumed,0)||' ≠ '||s.payable_vqe_points),
           s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
      JOIN LATERAL (
        SELECT SUM(c.points_consumed) FILTER (WHERE c.role<>'LARGEST') AS others_consumed, COUNT(*) AS n
          FROM public.expansion_team_consumptions c WHERE c.snapshot_id = s.id) x ON TRUE
     WHERE s.status_official IN ('closed','released')
       AND COALESCE(s.payable_vqe_points,0) > 0 AND x.n > 0
       AND ABS(COALESCE(x.others_consumed,0) - COALESCE(s.payable_vqe_points,0)) > 0.01
  ),
  c7 AS (
    SELECT 'CRITICAL','CONSUMO_SEM_FECHAMENTO',
           'Consumo de pontos sem fechamento correspondente',
           ('Consumo de '||c.points_consumed||' pontos'),
           c.user_id, c.period_start, c.id::text
      FROM public.expansion_team_consumptions c
     WHERE c.snapshot_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.expansion_period_snapshots s WHERE s.id = c.snapshot_id)
  ),
  c8 AS (
    SELECT 'HIGH','FECHAMENTO_SEM_CONSUMO',
           'Fechamento com volume qualificado, mas sem linhas de consumo',
           ('VQE pagável '||s.payable_vqe_points||' sem consumo registrado'),
           s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
     WHERE s.status_official IN ('closed','released')
       AND COALESCE(s.payable_vqe_points,0) > 0
       AND NOT EXISTS (SELECT 1 FROM public.expansion_team_consumptions c WHERE c.snapshot_id = s.id)
  ),
  c9 AS (
    SELECT 'CRITICAL','SALDO_NEGATIVO','Saldo de equipe negativo após consumo',
           ('Saldo após consumo: '||c.balance_after), c.user_id, c.period_start, c.id::text
      FROM public.expansion_team_consumptions c WHERE c.balance_after < 0
  ),
  c10 AS (
    SELECT 'HIGH','PONTOS_SEM_EQUIPE',
           'Pontos confirmados de parceiro sem vínculo de equipe válido',
           ('Pontos confirmados: '||SUM(l.points)), l.user_id, NULL::date, NULL::text
      FROM public.expansion_points_ledger l
     WHERE l.status='CONFIRMED'
       AND NOT EXISTS (SELECT 1 FROM public.expansion_team_memberships m
                        WHERE m.descendant_user_id = l.user_id
                          AND l.created_at >= m.effective_from
                          AND (m.effective_to IS NULL OR l.created_at < m.effective_to))
     GROUP BY l.user_id
  ),
  -- Anterior ao corte COM autorização administrativa explícita
  c11a AS (
    SELECT 'INFO','PRELAUNCH_AUTHORIZED',
           'Movimento anterior ao início oficial, preservado por decisão administrativa.',
           ('Lançado em '||to_char(l.created_at AT TIME ZONE 'America/Bahia','DD/MM/YYYY HH24:MI')
            ||' · '||l.points||' pts · origem '||COALESCE(l.source,'—')||' · ref '||COALESCE(l.source_ref,'—')),
           l.user_id, NULL::date, l.id::text
      FROM public.expansion_points_ledger l
     WHERE v_cut IS NOT NULL AND l.status='CONFIRMED' AND l.created_at < v_cut
       AND v_auth ? l.id::text
  ),
  -- Anterior ao corte SEM autorização
  c11b AS (
    SELECT 'HIGH','PONTOS_ANTES_DO_CORTE_SEM_AUTORIZACAO',
           'Pontos confirmados antes do início oficial sem autorização registrada',
           ('Lançado em '||to_char(l.created_at AT TIME ZONE 'America/Bahia','DD/MM/YYYY HH24:MI')
            ||' · '||l.points||' pts · ref '||COALESCE(l.source_ref,'—')),
           l.user_id, NULL::date, l.id::text
      FROM public.expansion_points_ledger l
     WHERE v_cut IS NOT NULL AND l.status='CONFIRMED' AND l.created_at < v_cut
       AND NOT (v_auth ? l.id::text)
  ),
  c12 AS (
    SELECT 'HIGH','DEMO_GERANDO_PONTOS','Contrato demonstrativo gerando pontos de expansão',
           ('Pontos confirmados a partir de contrato demo: '||l.points), l.user_id, NULL::date, l.id::text
      FROM public.expansion_points_ledger l
      JOIN public.partner_contracts pc ON pc.id = l.contract_id
     WHERE l.status='CONFIRMED' AND pc.is_demo IS TRUE
  ),
  c13 AS (
    SELECT 'HIGH','LIBERADO_SEM_REGISTRO_FINANCEIRO',
           'Fechamento liberado sem registro financeiro do Bônus de Expansão',
           ('Bônus liberado: '||s.final_bonus), s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
     WHERE s.status_official='released' AND COALESCE(s.final_bonus,0) > 0
       AND NOT EXISTS (SELECT 1 FROM public.partner_payouts p
                        WHERE p.payout_type='expansion_bonus' AND p.source_id = s.id)
  ),
  c14 AS (
    SELECT 'HIGH','LIBERADO_SEM_CARTEIRA','Fechamento liberado sem crédito na carteira de rede',
           ('Bônus liberado: '||s.final_bonus), s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
     WHERE s.status_official='released' AND COALESCE(s.final_bonus,0) > 0
       AND NOT EXISTS (SELECT 1 FROM public.partner_network_wallet_transactions t
                        WHERE t.bonus_type='expansion_bonus' AND t.source_id = s.id AND t.status='COMPLETED')
  ),
  c15 AS (
    SELECT 'HIGH','REGISTRO_FINANCEIRO_SEM_FECHAMENTO',
           'Registro financeiro de Bônus de Expansão sem fechamento correspondente',
           ('Valor: '||COALESCE(p.final_amount,p.amount,0)), NULL::uuid, p.period_start, p.id::text
      FROM public.partner_payouts p
     WHERE p.payout_type='expansion_bonus'
       AND (p.source_id IS NULL
            OR NOT EXISTS (SELECT 1 FROM public.expansion_period_snapshots s WHERE s.id = p.source_id))
  ),
  c16 AS (
    SELECT 'HIGH','CARTEIRA_SEM_FECHAMENTO','Crédito de expansão na carteira sem fechamento correspondente',
           ('Valor: '||t.amount), t.wallet_user_id, NULL::date, t.id::text
      FROM public.partner_network_wallet_transactions t
     WHERE t.bonus_type='expansion_bonus'
       AND (t.source_id IS NULL
            OR NOT EXISTS (SELECT 1 FROM public.expansion_period_snapshots s WHERE s.id = t.source_id))
  ),
  c17 AS (
    SELECT 'CRITICAL','VALORES_DIVERGENTES',
           'Divergência entre bônus do fechamento, registro financeiro e crédito da carteira',
           ('Fechamento '||s.final_bonus||' · registro financeiro '||COALESCE(pp.v,0)||' · carteira '||COALESCE(tt.v,0)),
           s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
      LEFT JOIN LATERAL (SELECT SUM(COALESCE(p.final_amount,p.amount,0)) v FROM public.partner_payouts p
                          WHERE p.payout_type='expansion_bonus' AND p.source_id=s.id
                            AND COALESCE(p.status,'')<>'CANCELLED') pp ON TRUE
      LEFT JOIN LATERAL (SELECT SUM(t.amount) v FROM public.partner_network_wallet_transactions t
                          WHERE t.bonus_type='expansion_bonus' AND t.source_id=s.id
                            AND t.direction='credit' AND t.status='COMPLETED') tt ON TRUE
     WHERE s.status_official='released' AND COALESCE(s.final_bonus,0) > 0
       AND (ABS(COALESCE(pp.v,0) - s.final_bonus) > 0.01 OR ABS(COALESCE(tt.v,0) - s.final_bonus) > 0.01)
  ),
  c18 AS (
    SELECT 'CRITICAL','SOURCE_REF_DUPLICADA',
           'Referência de origem duplicada em registros financeiros de expansão',
           ('Ocorrências: '||COUNT(*)||' para '||p.source_ref), NULL::uuid, MIN(p.period_start), p.source_ref
      FROM public.partner_payouts p
     WHERE p.payout_type='expansion_bonus' AND p.source_ref IS NOT NULL
     GROUP BY p.source_ref HAVING COUNT(*) > 1
  ),
  c19 AS (
    SELECT 'CRITICAL','SOURCE_REF_DUPLICADA_CARTEIRA',
           'Referência de origem duplicada em créditos de carteira de expansão',
           ('Ocorrências: '||COUNT(*)||' para '||t.source_ref), NULL::uuid, NULL::date, t.source_ref
      FROM public.partner_network_wallet_transactions t
     WHERE t.bonus_type='expansion_bonus' AND t.source_ref IS NOT NULL
     GROUP BY t.source_ref HAVING COUNT(*) > 1
  ),
  c20 AS (
    SELECT 'HIGH','EXPANSAO_CLASSIFICADA_COMO_REPASSE',
           'Registro originado de fechamento de expansão classificado como repasse semanal',
           ('Tipo atual: '||COALESCE(p.payout_type,'—')), NULL::uuid, p.period_start, p.id::text
      FROM public.partner_payouts p
     WHERE p.source_type IN ('expansion_period_snapshot','expansion_snapshot')
       AND COALESCE(p.payout_type,'') <> 'expansion_bonus'
  ),
  c21 AS (
    SELECT 'MEDIUM','EXPANSAO_PAID_AT_INDEVIDO',
           'Registro de expansão com data de pagamento preenchida sem status concluído',
           ('Status '||COALESCE(p.status,'—')||' com data de pagamento preenchida'),
           NULL::uuid, p.period_start, p.id::text
      FROM public.partner_payouts p
     WHERE p.payout_type='expansion_bonus' AND p.paid_at IS NOT NULL
       AND COALESCE(p.status,'') NOT IN ('PAID','COMPLETED')
  ),
  c22 AS (
    SELECT 'MEDIUM','FECHADO_NAO_LIBERADO',
           'Fechamento concluído e ainda não liberado após a janela esperada',
           ('Fechado em '||to_char(s.closed_at AT TIME ZONE 'America/Bahia','DD/MM/YYYY HH24:MI')),
           s.user_id, s.period_start, s.id::text
      FROM public.expansion_period_snapshots s
     WHERE s.status_official='closed' AND COALESCE(s.final_bonus,0) > 0
       AND s.closed_at IS NOT NULL AND s.closed_at < now() - INTERVAL '25 hours'
  ),
  c23 AS (
    SELECT 'INFO','PERIODO_SEM_VOLUME','Período processado sem volume qualificado',
           ('Parceiros sem volume: '||r.no_volume_count), NULL::uuid, r.period_start, r.id::text
      FROM public.expansion_close_runs r WHERE COALESCE(r.no_volume_count,0) > 0
  ),
  all_rows AS (
    SELECT * FROM c1 UNION ALL SELECT * FROM c2 UNION ALL SELECT * FROM c3 UNION ALL SELECT * FROM c4
    UNION ALL SELECT * FROM c5 UNION ALL SELECT * FROM c6 UNION ALL SELECT * FROM c7 UNION ALL SELECT * FROM c8
    UNION ALL SELECT * FROM c9 UNION ALL SELECT * FROM c10 UNION ALL SELECT * FROM c11a UNION ALL SELECT * FROM c11b
    UNION ALL SELECT * FROM c12 UNION ALL SELECT * FROM c13 UNION ALL SELECT * FROM c14 UNION ALL SELECT * FROM c15
    UNION ALL SELECT * FROM c16 UNION ALL SELECT * FROM c17 UNION ALL SELECT * FROM c18 UNION ALL SELECT * FROM c19
    UNION ALL SELECT * FROM c20 UNION ALL SELECT * FROM c21 UNION ALL SELECT * FROM c22 UNION ALL SELECT * FROM c23
  )
  SELECT a.sev, a.code, a.title, a.detail, a.user_id, nm.name, a.period_start, a.ref
    FROM all_rows a
    LEFT JOIN nm ON nm.id = a.user_id
   ORDER BY CASE a.sev WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
            a.period_start DESC NULLS LAST
   LIMIT GREATEST(COALESCE(_limit,300), 1);
END;
$function$;

REVOKE ALL ON FUNCTION public.expansion_admin_partner_points(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_admin_partner_points(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.expansion_admin_integrity_check(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expansion_admin_integrity_check(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_partner_points(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_admin_integrity_check(integer) TO authenticated;
