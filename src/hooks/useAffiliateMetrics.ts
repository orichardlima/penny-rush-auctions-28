import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateAffiliateMetrics, type MetricReferral, type MetricCommission, type MetricsPeriod } from '@/lib/affiliateMetrics';

export function useAffiliateMetrics(affiliateId: string | undefined, period: MetricsPeriod) {
  const [records, setRecords] = useState<{ referrals: MetricReferral[]; commissions: MetricCommission[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    setError(false);
    if (!affiliateId) return;
    async function load() {
      const referrals: MetricReferral[] = [];
      const commissions: MetricCommission[] = [];
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
      if (!cancelled) setRecords({ referrals, commissions });
    }
    load().catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [affiliateId]);
  return { metrics: records ? calculateAffiliateMetrics(records.referrals, records.commissions, period) : null, error };
}