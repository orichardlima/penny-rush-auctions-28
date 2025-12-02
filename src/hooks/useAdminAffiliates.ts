import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Affiliate {
  id: string;
  user_id: string;
  affiliate_code: string;
  status: string;
  commission_rate: number;
  total_referrals: number;
  total_conversions: number;
  commission_balance: number;
  total_commission_earned: number;
  total_commission_paid: number;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  pix_key?: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface Commission {
  id: string;
  affiliate_id: string;
  referred_user_id: string;
  purchase_id: string;
  purchase_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  created_at: string;
  approved_at?: string;
  paid_at?: string;
  affiliates?: {
    affiliate_code: string;
    profiles?: {
      full_name: string;
    };
  };
}

interface Withdrawal {
  id: string;
  affiliate_id: string;
  amount: number;
  payment_method: string;
  payment_details: any;
  status: string;
  created_at: string;
  processed_at?: string;
  rejection_reason?: string;
  affiliates?: {
    affiliate_code: string;
    pix_key?: string;
    profiles?: {
      full_name: string;
    };
  };
}

export const useAdminAffiliates = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAffiliates = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Buscar profiles separadamente
      if (data && data.length > 0) {
        const userIds = data.map(a => a.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        
        // Mapear profiles para affiliates
        const affiliatesWithProfiles = data.map(affiliate => ({
          ...affiliate,
          profiles: profilesData?.find(p => p.user_id === affiliate.user_id),
        }));
        
        setAffiliates(affiliatesWithProfiles as any);
      } else {
        setAffiliates([]);
      }
    } catch (error) {
      console.error('Error fetching affiliates:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar afiliados',
        variant: 'destructive',
      });
    }
  };

  const fetchCommissions = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliate_commissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Buscar affiliates e profiles separadamente
      if (data && data.length > 0) {
        const affiliateIds = [...new Set(data.map(c => c.affiliate_id))];
        const { data: affiliatesData } = await supabase
          .from('affiliates')
          .select('id, user_id, affiliate_code')
          .in('id', affiliateIds);
        
        if (affiliatesData && affiliatesData.length > 0) {
          const userIds = affiliatesData.map(a => a.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);
          
          // Mapear dados
          const commissionsWithData = data.map(commission => {
            const affiliate = affiliatesData.find(a => a.id === commission.affiliate_id);
            const profile = profilesData?.find(p => p.user_id === affiliate?.user_id);
            
            return {
              ...commission,
              affiliates: affiliate ? {
                affiliate_code: affiliate.affiliate_code,
                profiles: profile,
              } : undefined,
            };
          });
          
          setCommissions(commissionsWithData as any);
        } else {
          setCommissions(data as any);
        }
      } else {
        setCommissions([]);
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar comissões',
        variant: 'destructive',
      });
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliate_withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Buscar affiliates e profiles separadamente
      if (data && data.length > 0) {
        const affiliateIds = [...new Set(data.map(w => w.affiliate_id))];
        const { data: affiliatesData } = await supabase
          .from('affiliates')
          .select('id, user_id, affiliate_code, pix_key')
          .in('id', affiliateIds);
        
        if (affiliatesData && affiliatesData.length > 0) {
          const userIds = affiliatesData.map(a => a.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);
          
          // Mapear dados
          const withdrawalsWithData = data.map(withdrawal => {
            const affiliate = affiliatesData.find(a => a.id === withdrawal.affiliate_id);
            const profile = profilesData?.find(p => p.user_id === affiliate?.user_id);
            
            return {
              ...withdrawal,
              affiliates: affiliate ? {
                affiliate_code: affiliate.affiliate_code,
                pix_key: affiliate.pix_key,
                profiles: profile,
              } : undefined,
            };
          });
          
          setWithdrawals(withdrawalsWithData as any);
        } else {
          setWithdrawals(data as any);
        }
      } else {
        setWithdrawals([]);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar saques',
        variant: 'destructive',
      });
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAffiliates(),
      fetchCommissions(),
      fetchWithdrawals(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const approveAffiliate = async (affiliateId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('affiliates')
        .update({
          status: 'active',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq('id', affiliateId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Afiliado aprovado com sucesso!',
      });

      await fetchAffiliates();
    } catch (error) {
      console.error('Error approving affiliate:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao aprovar afiliado',
        variant: 'destructive',
      });
    }
  };

  const suspendAffiliate = async (affiliateId: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ status: 'suspended' })
        .eq('id', affiliateId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Afiliado suspenso com sucesso!',
      });

      await fetchAffiliates();
    } catch (error) {
      console.error('Error suspending affiliate:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao suspender afiliado',
        variant: 'destructive',
      });
    }
  };

  const updateCommissionRate = async (affiliateId: string, newRate: number) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ commission_rate: newRate })
        .eq('id', affiliateId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Taxa de comissão atualizada!',
      });

      await fetchAffiliates();
    } catch (error) {
      console.error('Error updating commission rate:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar taxa',
        variant: 'destructive',
      });
    }
  };

  const approveCommission = async (commissionId: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_commissions')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', commissionId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Comissão aprovada!',
      });

      await Promise.all([fetchCommissions(), fetchAffiliates()]);
    } catch (error) {
      console.error('Error approving commission:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao aprovar comissão',
        variant: 'destructive',
      });
    }
  };

  const cancelCommission = async (commissionId: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_commissions')
        .update({ status: 'cancelled' })
        .eq('id', commissionId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Comissão cancelada!',
      });

      await Promise.all([fetchCommissions(), fetchAffiliates()]);
    } catch (error) {
      console.error('Error cancelling commission:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao cancelar comissão',
        variant: 'destructive',
      });
    }
  };

  const processWithdrawal = async (withdrawalId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('affiliate_withdrawals')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          processed_by: user?.id,
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Saque processado com sucesso!',
      });

      await Promise.all([fetchWithdrawals(), fetchAffiliates()]);
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao processar saque',
        variant: 'destructive',
      });
    }
  };

  const rejectWithdrawal = async (withdrawalId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_withdrawals')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Saque rejeitado!',
      });

      await fetchWithdrawals();
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao rejeitar saque',
        variant: 'destructive',
      });
    }
  };

  const reactivateAffiliate = async (affiliateId: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ status: 'active' })
        .eq('id', affiliateId);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Afiliado reativado com sucesso!' });
      await fetchAllData();
    } catch (error) {
      console.error('Error reactivating affiliate:', error);
      toast({ title: 'Erro', description: 'Erro ao reativar afiliado', variant: 'destructive' });
    }
  };

  const deleteAffiliate = async (affiliateId: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', affiliateId);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Afiliado deletado com sucesso!' });
      await fetchAllData();
    } catch (error) {
      console.error('Error deleting affiliate:', error);
      toast({ title: 'Erro', description: 'Erro ao deletar afiliado', variant: 'destructive' });
    }
  };

  const getAffiliateDetails = async (affiliateId: string) => {
    try {
      const { data: affiliate, error: affiliateError } = await supabase
        .from('affiliates')
        .select('*')
        .eq('id', affiliateId)
        .single();

      if (affiliateError) throw affiliateError;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', affiliate.user_id)
        .single();

      const { data: referrals } = await supabase
        .from('affiliate_referrals')
        .select('id, referred_user_id, converted, created_at')
        .eq('affiliate_id', affiliateId);

      const referralUserIds = referrals?.filter(r => r.referred_user_id).map(r => r.referred_user_id) || [];
      const { data: referredUsers } = referralUserIds.length > 0
        ? await supabase.from('profiles').select('user_id, full_name').in('user_id', referralUserIds)
        : { data: [] };

      const { data: commissions } = await supabase
        .from('affiliate_commissions')
        .select('id, commission_amount, status, created_at, referred_user_id')
        .eq('affiliate_id', affiliateId);

      const commissionUserIds = commissions?.filter(c => c.referred_user_id).map(c => c.referred_user_id) || [];
      const { data: commissionUsers } = commissionUserIds.length > 0
        ? await supabase.from('profiles').select('user_id, full_name').in('user_id', commissionUserIds)
        : { data: [] };

      const { data: withdrawals } = await supabase
        .from('affiliate_withdrawals')
        .select('id, amount, status, created_at, processed_at')
        .eq('affiliate_id', affiliateId);

      const totalReferrals = referrals?.length || 0;
      const totalConversions = referrals?.filter(r => r.converted).length || 0;
      const conversionRate = totalReferrals > 0 ? (totalConversions / totalReferrals) * 100 : 0;

      return {
        id: affiliate.id,
        name: profile?.full_name || 'Sem nome',
        email: profile?.email || '',
        code: affiliate.affiliate_code,
        status: affiliate.status,
        commissionRate: affiliate.commission_rate,
        pixKey: affiliate.pix_key || '',
        createdAt: affiliate.created_at,
        approvedAt: affiliate.approved_at,
        totalReferrals,
        totalConversions,
        totalEarned: affiliate.total_commission_earned,
        totalPaid: affiliate.total_commission_paid,
        balance: affiliate.commission_balance,
        conversionRate,
        referrals: referrals?.map(r => ({
          id: r.id,
          name: referredUsers?.find(u => u.user_id === r.referred_user_id)?.full_name || 'Usuário',
          converted: r.converted,
          createdAt: r.created_at,
        })) || [],
        commissions: commissions?.map(c => ({
          id: c.id,
          amount: c.commission_amount,
          status: c.status,
          createdAt: c.created_at,
          referredUser: commissionUsers?.find(u => u.user_id === c.referred_user_id)?.full_name || 'Usuário',
        })) || [],
        withdrawals: withdrawals || [],
      };
    } catch (error) {
      console.error('Error fetching affiliate details:', error);
      toast({ title: 'Erro', description: 'Erro ao buscar detalhes', variant: 'destructive' });
      return null;
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({ title: 'Erro', description: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: 'Sucesso', description: 'Relatório exportado!' });
  };

  return {
    affiliates,
    commissions,
    withdrawals,
    loading,
    fetchAllData,
    approveAffiliate,
    suspendAffiliate,
    updateCommissionRate,
    approveCommission,
    cancelCommission,
    processWithdrawal,
    rejectWithdrawal,
    reactivateAffiliate,
    deleteAffiliate,
    getAffiliateDetails,
    exportToCSV,
  };
};
