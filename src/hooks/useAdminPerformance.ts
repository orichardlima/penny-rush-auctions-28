import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ---- Semana Bahia (UTC-3, sem DST) ----
export function bahiaTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function toBahiaMondayISO(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay(); // 0=dom..6=sab
  const back = dow === 0 ? 6 : dow - 1;
  utc.setUTCDate(utc.getUTCDate() - back);
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

export function shiftBahiaWeek(mondayISO: string, deltaWeeks: number): string {
  const [y, m, d] = mondayISO.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + deltaWeeks * 7);
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

export function formatWeekRange(mondayISO: string): string {
  const start = mondayISO;
  const [y, m, d] = mondayISO.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1, d));
  end.setUTCDate(end.getUTCDate() + 6);
  const endISO = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
  const fmt = (iso: string) => {
    const [Y, M, D] = iso.split('-');
    return `${D}/${M}/${Y}`;
  };
  return `${fmt(start)} – ${fmt(endISO)}`;
}

// ---- Tipos ----
export interface RankingRow {
  partner_user_id: string;
  full_name: string | null;
  email: string | null;
  affiliate_code: string | null;
  referral_code: string | null;
  display_name: string;
  total_points: number;
  click_points: number;
  conversion_points: number;
  active_days: number;
}

export interface EligibilityRow {
  partner_user_id: string;
  full_name: string | null;
  email: string | null;
  affiliate_code: string | null;
  referral_code: string | null;
  display_name: string;
  status: string;
  percentage: number;
  reason: string | null;
}

export interface KpiData {
  qualified_clicks: number;
  suspicious_clicks: number;
  signups: number;
  purchases_approved: number;
  contracts_approved: number;
  reversed: number;
}

export interface Inconsistency {
  kind: string;
  count: number;
  detail: string;
}

export const useAdminPerformance = (weekStart: string) => {
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityRow[]>([]);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [fraud, setFraud] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [backfill, setBackfill] = useState<any[]>([]);
  const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([]);
  const [centerEnabled, setCenterEnabled] = useState<boolean>(false);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekEnd = useMemo(() => {
    const [y, m, d] = weekStart.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 7);
    return dt.toISOString();
  }, [weekStart]);

  const weekStartISO = useMemo(() => `${weekStart}T00:00:00Z`, [weekStart]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Settings (flag)
      const settings = await supabase.from('performance_settings').select('*').limit(1).maybeSingle();
      if (settings.data) {
        setCenterEnabled(!!(settings.data as any).performance_center_enabled);
        setTrackingEnabled(!!(settings.data as any).performance_tracking_enabled);
      }

      // Ranking
      const scores = await supabase
        .from('partner_weekly_scores')
        .select('partner_user_id,total_points,click_points,conversion_points,active_days')
        .eq('week_start', weekStart)
        .order('total_points', { ascending: false })
        .limit(200);
      if (scores.error) throw scores.error;

      // Eligibility
      const elig = await supabase
        .from('partner_weekly_eligibility')
        .select('partner_user_id,status,percentage,reason')
        .eq('week_start', weekStart)
        .order('percentage', { ascending: false })
        .limit(200);
      if (elig.error) throw elig.error;

      // Anti-fraud
      const af = await supabase
        .from('anti_fraud_flags')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (af.error) throw af.error;

      // Buscar nomes reais para todos os parceiros envolvidos (uma única chamada)
      const allIds = Array.from(new Set([
        ...(scores.data ?? []).map((s: any) => s.partner_user_id),
        ...(elig.data ?? []).map((e: any) => e.partner_user_id),
        ...(af.data ?? []).map((f: any) => f.partner_user_id).filter(Boolean),
      ]));

      let profileMap = new Map<string, {
        full_name: string | null;
        email: string | null;
        affiliate_code: string | null;
        referral_code: string | null;
        display_name: string;
      }>();
      if (allIds.length) {
        const names = await supabase.rpc('admin_get_partner_display_names', {
          partner_ids: allIds,
        });
        if (names.error) throw names.error;
        (names.data ?? []).forEach((p: any) =>
          profileMap.set(p.id, {
            full_name: p.full_name,
            email: p.email,
            affiliate_code: p.affiliate_code,
            referral_code: p.referral_code,
            display_name: p.display_name,
          })
        );
      }

      const enrich = (partner_user_id: string) => ({
        full_name: profileMap.get(partner_user_id)?.full_name ?? null,
        email: profileMap.get(partner_user_id)?.email ?? null,
        affiliate_code: profileMap.get(partner_user_id)?.affiliate_code ?? null,
        referral_code: profileMap.get(partner_user_id)?.referral_code ?? null,
        display_name: profileMap.get(partner_user_id)?.display_name ?? 'Parceiro não identificado',
      });

      setRanking(
        (scores.data ?? []).map((s: any) => ({
          ...s,
          ...enrich(s.partner_user_id),
        }))
      );

      setEligibility(
        (elig.data ?? []).map((e: any) => ({
          ...e,
          ...enrich(e.partner_user_id),
        }))
      );

      setFraud(
        (af.data ?? []).map((f: any) => ({
          ...f,
          ...enrich(f.partner_user_id),
        }))
      );

      // KPIs: contagens dentro da semana. Cast em `any` para evitar TS2589 (chain profunda).
      const sb: any = supabase;
      const clicksAll = await sb
        .from('tracking_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekStartISO)
        .lt('created_at', weekEnd)
        .eq('event_type', 'qualified_click');
      const clicksDedupe = await sb
        .from('tracking_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekStartISO)
        .lt('created_at', weekEnd)
        .eq('is_suspicious', true);
      const ae = await sb
        .from('attribution_events')
        .select('conversion_type')
        .gte('created_at', weekStartISO)
        .lt('created_at', weekEnd);
      const aeReversed = await sb
        .from('attribution_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekStartISO)
        .lt('created_at', weekEnd)
        .eq('reversed', true);

      const aeRows = (ae.data ?? []) as { conversion_type: string }[];
      setKpis({
        qualified_clicks: clicksAll.count ?? 0,
        suspicious_clicks: clicksDedupe.count ?? 0,
        signups: aeRows.filter((r) => r.conversion_type === 'signup').length,
        purchases_approved: aeRows.filter((r) => r.conversion_type === 'purchase_approved').length,
        contracts_approved: aeRows.filter((r) => r.conversion_type === 'partner_plan_approved').length,
        reversed: aeReversed.count ?? 0,
      });

      // Audit logs
      const al = await supabase
        .from('performance_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setAudit(al.data ?? []);

      // Backfill issues
      const bf = await supabase
        .from('performance_backfill_issues')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setBackfill(bf.data ?? []);

      // Inconsistências: attribution sem tracking correlacionado
      const inc: Inconsistency[] = [];
      const orphan = await supabase
        .from('attribution_events')
        .select('id', { count: 'exact', head: true })
        .is('source_click_event_id', null)
        .gte('created_at', weekStartISO)
        .lt('created_at', weekEnd);
      inc.push({
        kind: 'Conversões sem clique de origem',
        count: orphan.count ?? 0,
        detail: 'attribution_events com source_click_event_id = NULL na semana selecionada',
      });

      const noAttr = await supabase
        .from('tracking_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'qualified_click')
        .is('partner_user_id', null)
        .gte('created_at', weekStartISO)
        .lt('created_at', weekEnd);
      inc.push({
        kind: 'Cliques sem parceiro atribuído',
        count: noAttr.count ?? 0,
        detail: 'tracking_events qualified_click com partner_user_id NULL',
      });

      setInconsistencies(inc);
    } catch (e: any) {
      console.error('[useAdminPerformance] erro:', e);
      setError(e.message ?? 'Erro ao carregar dados de performance');
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekStartISO, weekEnd]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return {
    ranking, eligibility, kpis, fraud, audit, backfill, inconsistencies,
    centerEnabled, trackingEnabled, loading, error, refetch: fetchAll,
  };
};
