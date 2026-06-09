import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateBrazil, getWeekStart, getWeekEnd } from '@/utils/weekHelpers';

export const REQUIRED_DAYS = 7;
export const FULL_PERCENTAGE = 100;
export const PENALTY_PERCENTAGE = 40;

export interface PartnerDay {
  date: string;
  completed: boolean;
  isFuture: boolean;
  isToday: boolean;
}

export interface PartnerWeekRow {
  contractId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  planName: string;
  cotas: number;
  days: PartnerDay[];
  completedCount: number;
  status: 'META' | 'PENALIDADE' | 'ZERADO' | 'EM_ANDAMENTO';
}

export const computeStatus = (
  completed: number,
  isCurrentWeek: boolean,
  todayIndex: number
): PartnerWeekRow['status'] => {
  if (completed >= REQUIRED_DAYS) return 'META';
  if (isCurrentWeek) {
    // semana ainda não fechou
    const remainingDays = REQUIRED_DAYS - 1 - todayIndex; // dias futuros
    if (completed + remainingDays >= REQUIRED_DAYS) return 'EM_ANDAMENTO';
    // já é impossível bater meta
    return completed === 0 ? 'ZERADO' : 'PENALIDADE';
  }
  return completed === 0 ? 'ZERADO' : 'PENALIDADE';
};

export const useAdminWeeklyAds = (referenceDate: Date) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PartnerWeekRow[]>([]);

  const weekStart = useMemo(() => getWeekStart(referenceDate), [referenceDate]);
  const weekEnd = useMemo(() => getWeekEnd(referenceDate), [referenceDate]);

  const today = useMemo(() => formatDateBrazil(new Date()), []);
  const isCurrentWeek = useMemo(() => {
    const now = new Date();
    return getWeekStart(now).getTime() === weekStart.getTime();
  }, [weekStart]);

  const todayIndex = useMemo(() => {
    if (!isCurrentWeek) return 6;
    const now = new Date();
    const day = now.getDay();
    return day === 0 ? 6 : day - 1; // Seg=0..Dom=6
  }, [isCurrentWeek]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1) contratos ativos
      const { data: contracts, error: cErr } = await supabase
        .from('partner_contracts')
        .select('id, user_id, plan_name, cotas, status')
        .eq('status', 'ACTIVE');
      if (cErr) throw cErr;

      const list = contracts || [];
      if (list.length === 0) {
        setRows([]);
        return;
      }

      const contractIds = list.map((c: any) => c.id);
      const userIds = Array.from(new Set(list.map((c: any) => c.user_id)));

      // 2) completions da semana
      const { data: completions, error: compErr } = await supabase
        .from('ad_center_completions')
        .select('partner_contract_id, completion_date')
        .in('partner_contract_id', contractIds)
        .gte('completion_date', formatDateBrazil(weekStart))
        .lte('completion_date', formatDateBrazil(weekEnd));
      if (compErr) throw compErr;

      // 3) profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .in('user_id', userIds);
      if (pErr) throw pErr;

      const profileMap = new Map<string, any>(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      // index completions by contract
      const compByContract = new Map<string, Set<string>>();
      (completions || []).forEach((c: any) => {
        const set = compByContract.get(c.partner_contract_id) || new Set<string>();
        set.add(c.completion_date);
        compByContract.set(c.partner_contract_id, set);
      });

      // gera 7 dias (Seg..Dom)
      const dayDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        dayDates.push(formatDateBrazil(d));
      }

      const result: PartnerWeekRow[] = list.map((c: any) => {
        const set = compByContract.get(c.id) || new Set<string>();
        const days: PartnerDay[] = dayDates.map((dateStr) => ({
          date: dateStr,
          completed: set.has(dateStr),
          isFuture: dateStr > today,
          isToday: dateStr === today,
        }));
        const completedCount = days.filter((d) => d.completed).length;
        const profile = profileMap.get(c.user_id) || {};
        return {
          contractId: c.id,
          userId: c.user_id,
          fullName: profile.full_name || '(sem nome)',
          email: profile.email || '',
          phone: profile.phone || null,
          planName: c.plan_name || '—',
          cotas: c.cotas || 1,
          days,
          completedCount,
          status: computeStatus(completedCount, isCurrentWeek, todayIndex),
        };
      });

      result.sort((a, b) => b.completedCount - a.completedCount || a.fullName.localeCompare(b.fullName));
      setRows(result);
    } catch (e) {
      console.error('[useAdminWeeklyAds] erro:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd, today, isCurrentWeek, todayIndex]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, rows, weekStart, weekEnd, isCurrentWeek, todayIndex, refresh: fetchData };
};

// Histórico — últimas N semanas para um contrato
export interface HistoryWeek {
  weekStart: string;
  weekEnd: string;
  completedCount: number;
  status: PartnerWeekRow['status'];
  days: PartnerDay[];
}

export const useAdminPartnerAdHistory = (contractId: string | null, weeksBack = 4) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryWeek[]>([]);

  useEffect(() => {
    if (!contractId) {
      setHistory([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const weeks: { start: Date; end: Date }[] = [];
        for (let i = 0; i < weeksBack; i++) {
          const ref = new Date(now);
          ref.setDate(now.getDate() - i * 7);
          weeks.push({ start: getWeekStart(ref), end: getWeekEnd(ref) });
        }
        const earliest = weeks[weeks.length - 1].start;
        const latest = weeks[0].end;
        const { data, error } = await supabase
          .from('ad_center_completions')
          .select('completion_date')
          .eq('partner_contract_id', contractId)
          .gte('completion_date', formatDateBrazil(earliest))
          .lte('completion_date', formatDateBrazil(latest));
        if (error) throw error;
        const dates = new Set((data || []).map((d: any) => d.completion_date));
        const todayStr = formatDateBrazil(now);
        const isCurrentWeekFn = (s: Date) => getWeekStart(now).getTime() === s.getTime();
        const todayDay = now.getDay();
        const todayIdx = todayDay === 0 ? 6 : todayDay - 1;

        const result: HistoryWeek[] = weeks.map(({ start, end }) => {
          const days: PartnerDay[] = [];
          for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const ds = formatDateBrazil(d);
            days.push({
              date: ds,
              completed: dates.has(ds),
              isFuture: ds > todayStr,
              isToday: ds === todayStr,
            });
          }
          const completedCount = days.filter((d) => d.completed).length;
          return {
            weekStart: formatDateBrazil(start),
            weekEnd: formatDateBrazil(end),
            completedCount,
            status: computeStatus(completedCount, isCurrentWeekFn(start), todayIdx),
            days,
          };
        });
        setHistory(result);
      } catch (e) {
        console.error('[useAdminPartnerAdHistory] erro:', e);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [contractId, weeksBack]);

  return { loading, history };
};
