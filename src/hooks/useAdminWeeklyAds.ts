import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  formatDateBrazil,
  getWeekStart,
  getWeekEnd,
  getWeekDays,
} from '@/utils/weekHelpers';

export type WeeklyAdsStatus = 'META' | 'PENALIDADE' | 'ZERADO' | 'EM_ANDAMENTO';

export interface WeeklyAdsRow {
  contract_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  plan_name: string;
  completedDates: string[]; // YYYY-MM-DD
  completedCount: number;
  status: WeeklyAdsStatus;
  payoutPercentage: number;
}

const REQUIRED_DAYS = 7;

export const useAdminWeeklyAds = (anchorDate: Date) => {
  const [rows, setRows] = useState<WeeklyAdsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = useMemo(() => getWeekStart(anchorDate), [anchorDate]);
  const weekEnd = useMemo(() => getWeekEnd(anchorDate), [anchorDate]);
  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const isCurrentWeek = useMemo(() => {
    const now = new Date();
    return now >= weekStart && now <= weekEnd;
  }, [weekStart, weekEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Contratos ativos
      const { data: contracts, error: cErr } = await supabase
        .from('partner_contracts')
        .select('id, user_id, plan_name, status')
        .eq('status', 'ACTIVE');
      if (cErr) throw cErr;

      const contractIds = (contracts || []).map((c: any) => c.id);
      const userIds = (contracts || []).map((c: any) => c.user_id);

      if (contractIds.length === 0) {
        setRows([]);
        return;
      }

      // Completions da semana
      const { data: completions, error: kErr } = await supabase
        .from('ad_center_completions')
        .select('partner_contract_id, completion_date')
        .in('partner_contract_id', contractIds)
        .gte('completion_date', formatDateBrazil(weekStart))
        .lte('completion_date', formatDateBrazil(weekEnd));
      if (kErr) throw kErr;

      // Profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .in('user_id', userIds);
      if (pErr) throw pErr;

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

      const completionMap = new Map<string, Set<string>>();
      (completions || []).forEach((c: any) => {
        if (!completionMap.has(c.partner_contract_id)) {
          completionMap.set(c.partner_contract_id, new Set());
        }
        completionMap.get(c.partner_contract_id)!.add(c.completion_date);
      });

      const today = new Date();
      const result: WeeklyAdsRow[] = (contracts || []).map((c: any) => {
        const dates = Array.from(completionMap.get(c.id) || []);
        const count = dates.length;
        const profile = profileMap.get(c.user_id) || {};

        let status: WeeklyAdsStatus;
        let payoutPercentage: number;

        if (count >= REQUIRED_DAYS) {
          status = 'META';
          payoutPercentage = 100;
        } else if (isCurrentWeek && today <= weekEnd) {
          status = count === 0 ? 'EM_ANDAMENTO' : 'EM_ANDAMENTO';
          payoutPercentage = count >= 1 ? 40 : 0;
          if (count === 0) status = 'EM_ANDAMENTO';
          else status = 'EM_ANDAMENTO';
        } else if (count === 0) {
          status = 'ZERADO';
          payoutPercentage = 0;
        } else {
          status = 'PENALIDADE';
          payoutPercentage = 40;
        }

        return {
          contract_id: c.id,
          user_id: c.user_id,
          user_name: profile.full_name || '—',
          user_email: profile.email || '—',
          user_phone: profile.phone || null,
          plan_name: c.plan_name,
          completedDates: dates,
          completedCount: count,
          status,
          payoutPercentage,
        };
      });

      setRows(result);
    } catch (err) {
      console.error('[useAdminWeeklyAds] erro:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd, isCurrentWeek]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      withAtLeastOne: rows.filter((r) => r.completedCount >= 1).length,
      meta: rows.filter((r) => r.status === 'META').length,
      penalty: rows.filter((r) => r.status === 'PENALIDADE').length,
      zero: rows.filter((r) => r.status === 'ZERADO').length,
      inProgress: rows.filter((r) => r.status === 'EM_ANDAMENTO').length,
    };
  }, [rows]);

  return {
    rows,
    summary,
    loading,
    weekDays,
    weekStart,
    weekEnd,
    isCurrentWeek,
    refresh: fetchData,
  };
};

// Histórico das últimas N semanas para um contrato
export const fetchContractHistory = async (
  contractId: string,
  weeksBack = 4
): Promise<{ weekStart: Date; weekEnd: Date; count: number; status: WeeklyAdsStatus }[]> => {
  const now = new Date();
  const oldest = new Date();
  oldest.setDate(now.getDate() - weeksBack * 7);
  const oldestStart = getWeekStart(oldest);

  const { data, error } = await supabase
    .from('ad_center_completions')
    .select('completion_date')
    .eq('partner_contract_id', contractId)
    .gte('completion_date', formatDateBrazil(oldestStart));

  if (error) {
    console.error('[fetchContractHistory] erro:', error);
    return [];
  }

  const dates = new Set((data || []).map((d: any) => d.completion_date));
  const today = formatDateBrazil(now);
  const result = [];
  for (let i = 0; i < weeksBack; i++) {
    const anchor = new Date();
    anchor.setDate(now.getDate() - i * 7);
    const ws = getWeekStart(anchor);
    const we = getWeekEnd(anchor);
    let count = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(ws);
      day.setDate(ws.getDate() + d);
      if (dates.has(formatDateBrazil(day))) count++;
    }
    const isCurrent = today >= formatDateBrazil(ws) && today <= formatDateBrazil(we);
    let status: WeeklyAdsStatus;
    if (count >= 7) status = 'META';
    else if (isCurrent) status = 'EM_ANDAMENTO';
    else if (count === 0) status = 'ZERADO';
    else status = 'PENALIDADE';
    result.push({ weekStart: ws, weekEnd: we, count, status });
  }
  return result;
};
