import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateAffiliateMetrics, type MetricReferral, type MetricCommission, type MetricClick, type MetricsPeriod } from '@/lib/affiliateMetrics';

export function useAffiliateMetrics(affiliateId: string | undefined, period: MetricsPeriod) {
  const [records, setRecords] = useState<{ referrals: MetricReferral[]; commissions: MetricCommission[]; clicks: MetricClick[]; startedAt?: string } | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let cancelled = false;
    if (tick === 0) setRecords(null);
    setError(false);
    if (!affiliateId) return;
    async function load() {
      const referrals: MetricReferral[] = [];
      const commissions: MetricCommission[] = [];
      const clicks: MetricClick[] = [];
      const { data: config, error: configError } = await supabase.from('affiliate_click_tracking_config').select('started_at').eq('id', true).single();
      if (configError) throw configError;
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('affiliate_click_events')
          .select('created_at,is_automated,visitor_id').eq('affiliate_id', affiliateId ?? '').order('id').range(offset, offset + 999);
        if (error) throw error;
        clicks.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('affiliate_referrals')
          .select('created_at,referred_user_id').eq('affiliate_id', affiliateId ?? '')
          .order('id').range(offset, offset + 999);
        if (error) throw error;
        referrals.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('affiliate_commissions')
          .select('created_at,approved_at,paid_at,referred_user_id,commission_amount,status')
          .eq('affiliate_id', affiliateId ?? '').order('id').range(offset, offset + 999);
        if (error) throw error;
        commissions.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      if (!cancelled) setRecords({ referrals, commissions, clicks, startedAt: config?.started_at });
    }
    load().catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [affiliateId, tick]);
  return { metrics: records ? calculateAffiliateMetrics(records.referrals, records.commissions, period, new Date(), records.clicks, records.startedAt) : null, error };
}