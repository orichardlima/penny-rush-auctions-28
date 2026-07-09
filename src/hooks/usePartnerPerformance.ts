import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Semana Bahia (UTC-3, sem DST) — segunda-feira
function bahiaTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function toBahiaMondayISO(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  utc.setUTCDate(utc.getUTCDate() - back);
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

export interface PartnerPerfSummary {
  referral_code: string | null;
  qualified_clicks: number;
  suspicious_clicks: number;
  signups: number;
  purchases_approved: number;
  contracts_approved: number;
  total_points: number;
  click_points: number;
  conversion_points: number;
  active_days: number;
  week_rank: number;
  week_total_partners: number;
}

export interface PartnerPerfHistoryRow {
  week_start: string;
  total_points: number;
  click_points: number;
  conversion_points: number;
}

export function usePartnerPerformance() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PartnerPerfSummary | null>(null);
  const [history, setHistory] = useState<PartnerPerfHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const weekStart = toBahiaMondayISO(bahiaTodayISO());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: settings } = await supabase
        .from('performance_settings')
        .select('setting_key,setting_value')
        .in('setting_key', ['performance_tracking_enabled', 'performance_center_partner_visible']);

      const map = new Map<string, string>((settings ?? []).map((r: any) => [r.setting_key, String(r.setting_value)]));
      const tracking = map.get('performance_tracking_enabled') === 'true';
      const partnerVisible = map.get('performance_center_partner_visible') === 'true';
      const isVisible = tracking && partnerVisible;
      setVisible(isVisible);

      if (!isVisible) {
        setSummary(null);
        setHistory([]);
        return;
      }

      const [{ data: sumData, error: sumErr }, { data: histData, error: histErr }] = await Promise.all([
        supabase.rpc('get_partner_performance_summary', { _week_start: weekStart }),
        supabase.rpc('get_partner_performance_history', { _weeks: 4 }),
      ]);

      if (sumErr) throw sumErr;
      if (histErr) throw histErr;

      const row = Array.isArray(sumData) && sumData.length > 0 ? sumData[0] : null;
      setSummary(row ? {
        referral_code: row.referral_code ?? null,
        qualified_clicks: Number(row.qualified_clicks ?? 0),
        suspicious_clicks: Number(row.suspicious_clicks ?? 0),
        signups: Number(row.signups ?? 0),
        purchases_approved: Number(row.purchases_approved ?? 0),
        contracts_approved: Number(row.contracts_approved ?? 0),
        total_points: Number(row.total_points ?? 0),
        click_points: Number(row.click_points ?? 0),
        conversion_points: Number(row.conversion_points ?? 0),
        active_days: Number(row.active_days ?? 0),
        week_rank: Number(row.week_rank ?? 0),
        week_total_partners: Number(row.week_total_partners ?? 0),
      } : null);

      setHistory(((histData as any[]) ?? []).map((r) => ({
        week_start: r.week_start,
        total_points: Number(r.total_points ?? 0),
        click_points: Number(r.click_points ?? 0),
        conversion_points: Number(r.conversion_points ?? 0),
      })));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar performance');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  return { visible, loading, summary, history, weekStart, error, reload: load };
}
