import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PartnerContractWithUser {
  id: string;
  user_id: string;
  plan_name: string;
  aporte_value: number;
  monthly_cap: number;
  total_cap: number;
  total_received: number;
  status: string;
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

export interface PartnerPlan {
  id: string;
  name: string;
  display_name: string;
  aporte_value: number;
  monthly_cap: number;
  total_cap: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyRevenueSnapshot {
  id: string;
  month: string;
  gross_revenue: number;
  partner_fund_percentage: number;
  partner_fund_value: number;
  is_closed: boolean;
  closed_at: string | null;
  created_at: string;
}

export interface PartnerPayoutWithContract {
  id: string;
  partner_contract_id: string;
  month: string;
  calculated_amount: number;
  amount: number;
  status: string;
  monthly_cap_applied: boolean;
  total_cap_applied: boolean;
  paid_at: string | null;
  created_at: string;
  contract?: PartnerContractWithUser;
}

export const useAdminPartners = () => {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<PartnerContractWithUser[]>([]);
  const [plans, setPlans] = useState<PartnerPlan[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayoutWithContract[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlyRevenueSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchContracts = useCallback(async () => {
    try {
      const { data: contractsData, error: contractsError } = await supabase
        .from('partner_contracts')
        .select('*')
        .order('created_at', { ascending: false });

      if (contractsError) throw contractsError;

      // Fetch user info for each contract
      const userIds = [...new Set(contractsData?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const contractsWithUsers = (contractsData || []).map(contract => ({
        ...contract,
        user_name: profilesMap.get(contract.user_id)?.full_name || 'N/A',
        user_email: profilesMap.get(contract.user_id)?.email || 'N/A'
      }));

      setContracts(contractsWithUsers);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar contratos",
        description: "Não foi possível carregar os contratos de parceiros."
      });
    }
  }, [toast]);

  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partner_plans')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  }, []);

  const fetchPayouts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partner_payouts')
        .select('*')
        .order('month', { ascending: false })
        .limit(100);

      if (error) throw error;
      setPayouts(data || []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    }
  }, []);

  const fetchSnapshots = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_revenue_snapshots')
        .select('*')
        .order('month', { ascending: false });

      if (error) throw error;
      setSnapshots(data || []);
    } catch (error) {
      console.error('Error fetching snapshots:', error);
    }
  }, []);

  const updateContractStatus = async (contractId: string, status: string, reason?: string) => {
    setProcessing(true);
    try {
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'CLOSED' || status === 'SUSPENDED') {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_reason = reason || null;
      }

      const { error } = await supabase
        .from('partner_contracts')
        .update(updateData)
        .eq('id', contractId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Contrato ${status === 'ACTIVE' ? 'ativado' : status === 'CLOSED' ? 'encerrado' : 'suspenso'} com sucesso.`
      });
      
      await fetchContracts();
    } catch (error: any) {
      console.error('Error updating contract status:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o status."
      });
    } finally {
      setProcessing(false);
    }
  };

  const updatePlan = async (planId: string, updates: Partial<PartnerPlan>) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('partner_plans')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', planId);

      if (error) throw error;

      toast({
        title: "Plano atualizado",
        description: "As configurações do plano foram salvas."
      });
      
      await fetchPlans();
    } catch (error: any) {
      console.error('Error updating plan:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar plano",
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const createPlan = async (plan: Omit<PartnerPlan, 'id' | 'created_at' | 'updated_at'>) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('partner_plans')
        .insert(plan);

      if (error) throw error;

      toast({
        title: "Plano criado",
        description: "O novo plano foi criado com sucesso."
      });
      
      await fetchPlans();
    } catch (error: any) {
      console.error('Error creating plan:', error);
      toast({
        variant: "destructive",
        title: "Erro ao criar plano",
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const processMonthlyPayouts = async (month: string, fundPercentage: number) => {
    setProcessing(true);
    try {
      // 1. Calcular faturamento bruto do mês
      const startOfMonth = new Date(month);
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);

      const { data: purchases, error: purchasesError } = await supabase
        .from('bid_purchases')
        .select('amount_paid')
        .eq('payment_status', 'completed')
        .gte('created_at', startOfMonth.toISOString())
        .lt('created_at', endOfMonth.toISOString());

      if (purchasesError) throw purchasesError;

      const grossRevenue = purchases?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
      const partnerFundValue = grossRevenue * (fundPercentage / 100);

      // 2. Criar snapshot do mês
      const { error: snapshotError } = await supabase
        .from('monthly_revenue_snapshots')
        .upsert({
          month: month,
          gross_revenue: grossRevenue,
          partner_fund_percentage: fundPercentage,
          partner_fund_value: partnerFundValue
        }, { onConflict: 'month' });

      if (snapshotError) throw snapshotError;

      // 3. Buscar contratos ativos
      const { data: activeContracts, error: contractsError } = await supabase
        .from('partner_contracts')
        .select('*')
        .eq('status', 'ACTIVE');

      if (contractsError) throw contractsError;

      if (!activeContracts || activeContracts.length === 0) {
        toast({
          title: "Sem contratos ativos",
          description: "Não há contratos ativos para processar repasses."
        });
        setProcessing(false);
        return;
      }

      // 4. Calcular distribuição proporcional
      const totalAportes = activeContracts.reduce((sum, c) => sum + c.aporte_value, 0);

      for (const contract of activeContracts) {
        const participation = contract.aporte_value / totalAportes;
        let calculatedAmount = partnerFundValue * participation;
        let amount = calculatedAmount;
        let monthlyCapApplied = false;
        let totalCapApplied = false;

        // Aplicar limite mensal
        if (amount > contract.monthly_cap) {
          amount = contract.monthly_cap;
          monthlyCapApplied = true;
        }

        // Aplicar teto total
        const remaining = contract.total_cap - contract.total_received;
        if (amount > remaining) {
          amount = remaining;
          totalCapApplied = true;
        }

        // Criar registro de repasse
        await supabase
          .from('partner_payouts')
          .insert({
            partner_contract_id: contract.id,
            month: month,
            calculated_amount: calculatedAmount,
            amount: amount,
            status: 'PENDING',
            monthly_cap_applied: monthlyCapApplied,
            total_cap_applied: totalCapApplied
          });

        // Atualizar total recebido do contrato
        const newTotalReceived = contract.total_received + amount;
        const updates: any = { 
          total_received: newTotalReceived,
          updated_at: new Date().toISOString()
        };

        // Se atingiu o teto, encerrar contrato
        if (newTotalReceived >= contract.total_cap) {
          updates.status = 'CLOSED';
          updates.closed_at = new Date().toISOString();
          updates.closed_reason = 'Teto total atingido';
        }

        await supabase
          .from('partner_contracts')
          .update(updates)
          .eq('id', contract.id);
      }

      toast({
        title: "Repasses processados",
        description: `${activeContracts.length} contratos processados para ${month}`
      });

      await Promise.all([fetchContracts(), fetchPayouts(), fetchSnapshots()]);
    } catch (error: any) {
      console.error('Error processing payouts:', error);
      toast({
        variant: "destructive",
        title: "Erro ao processar repasses",
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const markPayoutAsPaid = async (payoutId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('partner_payouts')
        .update({ 
          status: 'PAID', 
          paid_at: new Date().toISOString() 
        })
        .eq('id', payoutId);

      if (error) throw error;

      toast({
        title: "Pagamento confirmado",
        description: "O repasse foi marcado como pago."
      });

      await fetchPayouts();
    } catch (error: any) {
      console.error('Error marking payout as paid:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchContracts(), fetchPlans(), fetchPayouts(), fetchSnapshots()]);
      setLoading(false);
    };
    loadData();
  }, [fetchContracts, fetchPlans, fetchPayouts, fetchSnapshots]);

  const stats = {
    totalContracts: contracts.length,
    activeContracts: contracts.filter(c => c.status === 'ACTIVE').length,
    totalAportes: contracts.filter(c => c.status === 'ACTIVE').reduce((sum, c) => sum + c.aporte_value, 0),
    totalPaid: contracts.reduce((sum, c) => sum + c.total_received, 0),
    pendingPayouts: payouts.filter(p => p.status === 'PENDING').length
  };

  return {
    contracts,
    plans,
    payouts,
    snapshots,
    stats,
    loading,
    processing,
    updateContractStatus,
    updatePlan,
    createPlan,
    processMonthlyPayouts,
    markPayoutAsPaid,
    refreshData: async () => {
      await Promise.all([fetchContracts(), fetchPlans(), fetchPayouts(), fetchSnapshots()]);
    }
  };
};
