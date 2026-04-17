import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ManagerAuditEntry {
  id: string;
  action_type: string;
  manager_affiliate_id: string;
  influencer_affiliate_id: string;
  performed_by: string;
  old_value: any;
  new_value: any;
  notes: string | null;
  created_at: string;
  influencer_code?: string;
  influencer_name?: string;
}

export const useManagerAudit = (managerAffiliateId: string | null) => {
  const [entries, setEntries] = useState<ManagerAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAudit = async () => {
    if (!managerAffiliateId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('affiliate_manager_audit' as any)
        .select('*')
        .eq('manager_affiliate_id', managerAffiliateId)
        .order('created_at', { ascending: false })
        .limit(100) as any);

      if (error) throw error;

      const rows = (data || []) as any[];
      const influencerIds = [...new Set(rows.map(r => r.influencer_affiliate_id))];

      let influencerMap: Record<string, { code: string; name: string }> = {};
      if (influencerIds.length > 0) {
        const { data: affs } = await supabase
          .from('affiliates')
          .select('id, affiliate_code, user_id')
          .in('id', influencerIds);

        const userIds = (affs || []).map(a => a.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
        influencerMap = Object.fromEntries(
          (affs || []).map(a => [a.id, {
            code: a.affiliate_code,
            name: profileMap.get(a.user_id) || 'Sem nome',
          }])
        );
      }

      setEntries(rows.map(r => ({
        ...r,
        influencer_code: influencerMap[r.influencer_affiliate_id]?.code,
        influencer_name: influencerMap[r.influencer_affiliate_id]?.name,
      })));
    } catch (e) {
      console.error('Error fetching manager audit:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [managerAffiliateId]);

  return { entries, loading, refetch: fetchAudit };
};
