import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface InfluencerData {
  id: string;
  affiliate_id: string;
  affiliate_code: string;
  full_name: string;
  email: string;
  total_conversions: number;
  total_commission_earned: number;
  override_rate: number;
  status: string;
  created_at: string;
}

interface ManagerStats {
  totalInfluencers: number;
  totalOverrideEarned: number;
  totalNetworkSales: number;
}

export const useAffiliateManager = (affiliateId: string | null) => {
  const [influencers, setInfluencers] = useState<InfluencerData[]>([]);
  const [stats, setStats] = useState<ManagerStats>({ totalInfluencers: 0, totalOverrideEarned: 0, totalNetworkSales: 0 });
  const [loading, setLoading] = useState(false);

  const fetchInfluencers = async () => {
    if (!affiliateId) return;
    setLoading(true);
    try {
      // Fetch manager links
      const { data: links, error } = await (supabase
        .from('affiliate_managers' as any)
        .select('*')
        .eq('manager_affiliate_id', affiliateId) as any);

      if (error) throw error;
      if (!links || links.length === 0) {
        setInfluencers([]);
        setStats({ totalInfluencers: 0, totalOverrideEarned: 0, totalNetworkSales: 0 });
        setLoading(false);
        return;
      }

      const influencerIds = links.map((l: any) => l.influencer_affiliate_id);

      // Fetch affiliate data for influencers
      const { data: affiliatesData } = await supabase
        .from('affiliates')
        .select('id, affiliate_code, user_id, total_conversions, total_commission_earned')
        .in('id', influencerIds);

      if (!affiliatesData) {
        setInfluencers([]);
        setLoading(false);
        return;
      }

      // Fetch profiles
      const userIds = affiliatesData.map(a => a.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const influencerList: InfluencerData[] = links.map((link: any) => {
        const aff = affiliatesData.find(a => a.id === link.influencer_affiliate_id);
        const profile = profiles?.find(p => p.user_id === aff?.user_id);
        return {
          id: link.id,
          affiliate_id: link.influencer_affiliate_id,
          affiliate_code: aff?.affiliate_code || '',
          full_name: profile?.full_name || 'Sem nome',
          email: profile?.email || '',
          total_conversions: aff?.total_conversions || 0,
          total_commission_earned: aff?.total_commission_earned || 0,
          override_rate: link.override_rate,
          status: link.status,
          created_at: link.created_at,
        };
      });

      setInfluencers(influencerList);

      // Calculate stats
      const totalNetworkSales = influencerList.reduce((sum, i) => sum + i.total_conversions, 0);
      const totalOverrideEarned = influencerList.reduce((sum, i) => {
        return sum + (i.total_commission_earned * i.override_rate / 100);
      }, 0);

      setStats({
        totalInfluencers: influencerList.filter(i => i.status === 'active').length,
        totalOverrideEarned: Math.round(totalOverrideEarned * 100) / 100,
        totalNetworkSales,
      });
    } catch (error) {
      console.error('Error fetching influencers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfluencers();
  }, [affiliateId]);

  const linkInfluencerByCode = async (affiliateCode: string) => {
    if (!affiliateId) throw new Error('Sem affiliate ID');

    // 1. Find affiliate by code
    const { data: targetAffiliate, error: findError } = await supabase
      .from('affiliates')
      .select('id, user_id, role, status')
      .eq('affiliate_code', affiliateCode.trim().toUpperCase())
      .single();

    if (findError || !targetAffiliate) {
      toast({ title: 'Erro', description: 'Código de afiliado não encontrado.', variant: 'destructive' });
      return false;
    }

    // 2. Validations
    if (targetAffiliate.id === affiliateId) {
      toast({ title: 'Erro', description: 'Você não pode vincular a si mesmo.', variant: 'destructive' });
      return false;
    }
    if (targetAffiliate.status !== 'active') {
      toast({ title: 'Erro', description: 'Este afiliado não está ativo.', variant: 'destructive' });
      return false;
    }
    if (targetAffiliate.role === 'manager') {
      toast({ title: 'Erro', description: 'Este afiliado já é um gerente.', variant: 'destructive' });
      return false;
    }

    // 3. Check if already has a manager
    const { data: existingLink } = await (supabase
      .from('affiliate_managers' as any)
      .select('id')
      .eq('influencer_affiliate_id', targetAffiliate.id) as any);

    if (existingLink && existingLink.length > 0) {
      toast({ title: 'Erro', description: 'Este afiliado já está vinculado a um gerente.', variant: 'destructive' });
      return false;
    }

    // 4. Get default override rate from system settings
    const { data: settingData } = await supabase
      .from('system_settings' as any)
      .select('value')
      .eq('key', 'affiliate_default_override_rate')
      .single() as any;

    const defaultRate = settingData?.value ? parseFloat(settingData.value) : 2;

    // 5. Create link
    const { error: insertError } = await (supabase
      .from('affiliate_managers' as any)
      .insert({
        manager_affiliate_id: affiliateId,
        influencer_affiliate_id: targetAffiliate.id,
        override_rate: defaultRate,
        status: 'active',
      }) as any);

    if (insertError) {
      const msg = insertError.code === '23505'
        ? 'Este influencer já está vinculado a um gerente.'
        : 'Erro ao vincular influencer.';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Sucesso! 🎉', description: 'Influencer vinculado com sucesso!' });
    await fetchInfluencers();
    return true;
  };

  const unlinkMyInfluencer = async (linkId: string) => {
    try {
      const { error } = await (supabase
        .from('affiliate_managers' as any)
        .delete()
        .eq('id', linkId) as any);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Influencer desvinculado.' });
      await fetchInfluencers();
    } catch (error) {
      console.error('Error unlinking influencer:', error);
      toast({ title: 'Erro', description: 'Erro ao desvincular influencer.', variant: 'destructive' });
    }
  };

  return {
    influencers,
    stats,
    loading,
    refetch: fetchInfluencers,
    linkInfluencerByCode,
    unlinkMyInfluencer,
  };
};

// Admin functions
export const useAdminAffiliateManagers = () => {
  const [managerLinks, setManagerLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchManagerLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('affiliate_managers' as any)
        .select('*')
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;

      if (data && data.length > 0) {
        const allAffiliateIds = [
          ...new Set([
            ...data.map((d: any) => d.manager_affiliate_id),
            ...data.map((d: any) => d.influencer_affiliate_id),
          ]),
        ];

        const { data: affiliatesData } = await supabase
          .from('affiliates')
          .select('id, affiliate_code, user_id')
          .in('id', allAffiliateIds);

        const userIds = affiliatesData?.map(a => a.user_id) || [];
        const { data: profiles } = userIds.length > 0
          ? await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
          : { data: [] };

        const enriched = data.map((link: any) => {
          const managerAff = affiliatesData?.find(a => a.id === link.manager_affiliate_id);
          const influencerAff = affiliatesData?.find(a => a.id === link.influencer_affiliate_id);
          const managerProfile = profiles?.find(p => p.user_id === managerAff?.user_id);
          const influencerProfile = profiles?.find(p => p.user_id === influencerAff?.user_id);

          return {
            ...link,
            manager_name: managerProfile?.full_name || 'Sem nome',
            manager_code: managerAff?.affiliate_code || '',
            influencer_name: influencerProfile?.full_name || 'Sem nome',
            influencer_code: influencerAff?.affiliate_code || '',
          };
        });

        setManagerLinks(enriched);
      } else {
        setManagerLinks([]);
      }
    } catch (error) {
      console.error('Error fetching manager links:', error);
    } finally {
      setLoading(false);
    }
  };

  const promoteToManager = async (affiliateId: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ role: 'manager' } as any)
        .eq('id', affiliateId);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Afiliado promovido a gerente!' });
    } catch (error) {
      console.error('Error promoting to manager:', error);
      toast({ title: 'Erro', description: 'Erro ao promover afiliado', variant: 'destructive' });
    }
  };

  const linkInfluencer = async (managerAffiliateId: string, influencerAffiliateId: string, overrideRate: number) => {
    try {
      // Update influencer role
      await supabase
        .from('affiliates')
        .update({ role: 'influencer', recruited_by_affiliate_id: managerAffiliateId } as any)
        .eq('id', influencerAffiliateId);

      // Create manager link
      const { error } = await (supabase
        .from('affiliate_managers' as any)
        .insert({
          manager_affiliate_id: managerAffiliateId,
          influencer_affiliate_id: influencerAffiliateId,
          override_rate: overrideRate,
          status: 'active',
        }) as any);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Influencer vinculado ao gerente!' });
      await fetchManagerLinks();
    } catch (error: any) {
      console.error('Error linking influencer:', error);
      const msg = error?.code === '23505' ? 'Este influencer já está vinculado a um gerente' : 'Erro ao vincular influencer';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    }
  };

  const unlinkInfluencer = async (linkId: string, influencerAffiliateId: string) => {
    try {
      await (supabase.from('affiliate_managers' as any).delete().eq('id', linkId) as any);
      await supabase
        .from('affiliates')
        .update({ role: 'affiliate', recruited_by_affiliate_id: null } as any)
        .eq('id', influencerAffiliateId);

      toast({ title: 'Sucesso', description: 'Vínculo removido!' });
      await fetchManagerLinks();
    } catch (error) {
      console.error('Error unlinking influencer:', error);
      toast({ title: 'Erro', description: 'Erro ao remover vínculo', variant: 'destructive' });
    }
  };

  const updateOverrideRate = async (linkId: string, newRate: number) => {
    try {
      const { error } = await (supabase
        .from('affiliate_managers' as any)
        .update({ override_rate: newRate })
        .eq('id', linkId) as any);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Taxa de override atualizada!' });
      await fetchManagerLinks();
    } catch (error) {
      console.error('Error updating override rate:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar taxa', variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchManagerLinks();
  }, []);

  return {
    managerLinks,
    loading,
    promoteToManager,
    linkInfluencer,
    unlinkInfluencer,
    updateOverrideRate,
    refetch: fetchManagerLinks,
  };
};
