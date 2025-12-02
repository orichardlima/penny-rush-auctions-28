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
  };
};
