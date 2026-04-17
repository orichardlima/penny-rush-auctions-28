import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface InfluencerMetric {
  link_id: string;
  influencer_affiliate_id: string;
  influencer_user_id: string;
  affiliate_code: string;
  full_name: string;
  email: string;
  status: 'active' | 'paused' | 'blocked' | 'pending';
  override_rate: number;
  recruited_at: string | null;
  total_clicks: number;
  total_signups: number;
  unique_buyers: number;
  conversion_rate: number;
  total_sales: number;
  total_commission: number;
  total_override: number;
}

export interface ManagerAggregateStats {
  totalInfluencers: number;
  activeInfluencers: number;
  totalClicks: number;
  totalSignups: number;
  totalBuyers: number;
  totalSales: number;
  totalOverride: number;
  avgConversionRate: number;
}

export const useManagerInfluencerMetrics = (managerAffiliateId: string | null) => {
  const [metrics, setMetrics] = useState<InfluencerMetric[]>([]);
  const [stats, setStats] = useState<ManagerAggregateStats>({
    totalInfluencers: 0,
    activeInfluencers: 0,
    totalClicks: 0,
    totalSignups: 0,
    totalBuyers: 0,
    totalSales: 0,
    totalOverride: 0,
    avgConversionRate: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    if (!managerAffiliateId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('get_manager_influencer_metrics', {
        p_manager_affiliate_id: managerAffiliateId,
      });

      if (error) throw error;

      const list: InfluencerMetric[] = (data || []).map((d: any) => ({
        ...d,
        total_clicks: Number(d.total_clicks || 0),
        total_signups: Number(d.total_signups || 0),
        unique_buyers: Number(d.unique_buyers || 0),
        conversion_rate: Number(d.conversion_rate || 0),
        total_sales: Number(d.total_sales || 0),
        total_commission: Number(d.total_commission || 0),
        total_override: Number(d.total_override || 0),
        override_rate: Number(d.override_rate || 0),
      }));

      setMetrics(list);

      const active = list.filter((i) => i.status === 'active');
      const totalClicks = list.reduce((s, i) => s + i.total_clicks, 0);
      const totalBuyers = list.reduce((s, i) => s + i.unique_buyers, 0);

      setStats({
        totalInfluencers: list.length,
        activeInfluencers: active.length,
        totalClicks,
        totalSignups: list.reduce((s, i) => s + i.total_signups, 0),
        totalBuyers,
        totalSales: list.reduce((s, i) => s + i.total_sales, 0),
        totalOverride: list.reduce((s, i) => s + i.total_override, 0),
        avgConversionRate: totalClicks > 0 ? Math.round((totalBuyers * 10000) / totalClicks) / 100 : 0,
      });
    } catch (e: any) {
      console.error('Error fetching influencer metrics:', e);
      toast({ title: 'Erro', description: 'Erro ao carregar métricas dos influencers.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [managerAffiliateId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const updateInfluencerStatus = async (
    linkId: string,
    newStatus: 'active' | 'paused' | 'blocked',
    managerAffiliateIdForAudit: string,
    influencerAffiliateId: string,
    oldStatus: string,
  ) => {
    try {
      const { error } = await (supabase
        .from('affiliate_managers' as any)
        .update({ status: newStatus })
        .eq('id', linkId) as any);

      if (error) throw error;

      // Audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase.from('affiliate_manager_audit' as any).insert({
          manager_affiliate_id: managerAffiliateIdForAudit,
          influencer_affiliate_id: influencerAffiliateId,
          action_type: 'status_changed',
          performed_by: user.id,
          old_value: { status: oldStatus },
          new_value: { status: newStatus },
        }) as any);
      }

      toast({
        title: 'Status atualizado',
        description: `Influencer ${newStatus === 'active' ? 'ativado' : newStatus === 'paused' ? 'pausado' : 'bloqueado'}.`,
      });
      await fetchMetrics();
      return true;
    } catch (e) {
      console.error('Error updating status:', e);
      toast({ title: 'Erro', description: 'Não foi possível atualizar o status.', variant: 'destructive' });
      return false;
    }
  };

  return { metrics, stats, loading, refetch: fetchMetrics, updateInfluencerStatus };
};
