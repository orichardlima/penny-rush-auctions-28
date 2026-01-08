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
  is_manual?: boolean;
  manual_base?: string | null;
  manual_percentage?: number | null;
  manual_description?: string | null;
}

export interface ManualPayoutOptions {
  manualMode: boolean;
  manualBase: 'aporte' | 'monthly_cap';
  manualPercentage: number;
  manualDescription?: string;
  cutoffDay?: number;
}

// Helper function to check if a contract is eligible for a given month based on cutoff
export const isContractEligibleForMonth = (
  contractCreatedAt: string,
  month: string,
  cutoffDay: number
): { eligible: boolean; reason: string } => {
  const contractDate = new Date(contractCreatedAt);
  const [year, monthNum] = month.split('-').map(Number);
  const processingMonthStart = new Date(year, monthNum - 1, 1);
  
  // If the contract was created before the processing month, it's eligible
  if (contractDate < processingMonthStart) {
    return { eligible: true, reason: 'Cadastro anterior ao mês' };
  }
  
  // If the contract was created in the same month
  if (contractDate.getFullYear() === year && contractDate.getMonth() + 1 === monthNum) {
    // Only eligible if registered on or before the cutoff day
    if (contractDate.getDate() <= cutoffDay) {
      return { eligible: true, reason: `Cadastro até dia ${cutoffDay}` };
    } else {
      return { eligible: false, reason: `Cadastro após dia ${cutoffDay}` };
    }
  }
  
  // If the contract was created after the processing month (shouldn't happen normally)
  return { eligible: false, reason: 'Cadastro posterior ao mês' };
};

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

export interface PartnerWithdrawalWithUser {
  id: string;
  partner_contract_id: string;
  amount: number;
  payment_method: string;
  payment_details: {
    pix_key?: string;
    pix_key_type?: string;
    holder_name?: string;
  };
  status: string;
  rejection_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  plan_name?: string;
}

export const useAdminPartners = () => {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<PartnerContractWithUser[]>([]);
  const [plans, setPlans] = useState<PartnerPlan[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayoutWithContract[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlyRevenueSnapshot[]>([]);
  const [withdrawals, setWithdrawals] = useState<PartnerWithdrawalWithUser[]>([]);
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

  const deletePlan = async (planId: string) => {
    setProcessing(true);
    try {
      // Check if there are contracts using this plan
      const plan = plans.find(p => p.id === planId);
      if (!plan) throw new Error('Plano não encontrado');

      const contractsUsingPlan = contracts.filter(c => c.plan_name === plan.name);
      
      if (contractsUsingPlan.length > 0) {
        // Just deactivate if there are contracts
        const { error } = await supabase
          .from('partner_plans')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', planId);

        if (error) throw error;

        toast({
          title: "Plano desativado",
          description: `O plano possui ${contractsUsingPlan.length} contrato(s) vinculado(s) e foi desativado.`
        });
      } else {
        // Delete permanently if no contracts
        const { error } = await supabase
          .from('partner_plans')
          .delete()
          .eq('id', planId);

        if (error) throw error;

        toast({
          title: "Plano deletado",
          description: "O plano foi removido permanentemente."
        });
      }
      
      await fetchPlans();
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast({
        variant: "destructive",
        title: "Erro ao deletar plano",
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const cancelPayout = async (payoutId: string, reason: string) => {
    setProcessing(true);
    try {
      // Get the payout details
      const payout = payouts.find(p => p.id === payoutId);
      if (!payout) throw new Error('Repasse não encontrado');
      if (payout.status !== 'PENDING') throw new Error('Apenas repasses pendentes podem ser cancelados');

      // Get the contract
      const contract = contracts.find(c => c.id === payout.partner_contract_id);
      if (!contract) throw new Error('Contrato não encontrado');

      // Update payout status to CANCELLED
      const { error: payoutError } = await supabase
        .from('partner_payouts')
        .update({ 
          status: 'CANCELLED'
        })
        .eq('id', payoutId);

      if (payoutError) throw payoutError;

      // Subtract the amount from contract's total_received
      const newTotalReceived = Math.max(0, contract.total_received - payout.amount);
      const updates: any = {
        total_received: newTotalReceived,
        updated_at: new Date().toISOString()
      };

      // If contract was CLOSED due to cap, reactivate it
      if (contract.status === 'CLOSED' && contract.closed_reason === 'Teto total atingido') {
        updates.status = 'ACTIVE';
        updates.closed_at = null;
        updates.closed_reason = null;
      }

      const { error: contractError } = await supabase
        .from('partner_contracts')
        .update(updates)
        .eq('id', contract.id);

      if (contractError) throw contractError;

      toast({
        title: "Repasse cancelado",
        description: `Repasse cancelado. Motivo: ${reason}`
      });

      await Promise.all([fetchContracts(), fetchPayouts()]);
    } catch (error: any) {
      console.error('Error cancelling payout:', error);
      toast({
        variant: "destructive",
        title: "Erro ao cancelar repasse",
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const processMonthlyPayouts = async (month: string, fundPercentage: number, options?: ManualPayoutOptions) => {
    setProcessing(true);
    try {
      // Get cutoff day from options or default to 10
      const cutoffDay = options?.cutoffDay || 10;

      // 1. Buscar contratos ativos
      const { data: allActiveContracts, error: contractsError } = await supabase
        .from('partner_contracts')
        .select('*')
        .eq('status', 'ACTIVE');

      if (contractsError) throw contractsError;

      if (!allActiveContracts || allActiveContracts.length === 0) {
        toast({
          title: "Sem contratos ativos",
          description: "Não há contratos ativos para processar repasses."
        });
        setProcessing(false);
        return;
      }

      // Filter contracts by cutoff eligibility
      const activeContracts = allActiveContracts.filter(contract => {
        const { eligible } = isContractEligibleForMonth(contract.created_at, month, cutoffDay);
        return eligible;
      });

      if (activeContracts.length === 0) {
        toast({
          title: "Sem contratos elegíveis",
          description: `Nenhum contrato é elegível para o mês selecionado (corte: dia ${cutoffDay}).`
        });
        setProcessing(false);
        return;
      }

      const skippedCount = allActiveContracts.length - activeContracts.length;
      if (skippedCount > 0) {
        console.log(`${skippedCount} contrato(s) não elegível(is) para este mês (cadastro após dia ${cutoffDay})`);
      }

      let grossRevenue = 0;
      let partnerFundValue = 0;
      let snapshotData: any = {
        month: month,
        is_manual: false,
        manual_base: null,
        manual_percentage: null,
        manual_description: null
      };

      if (options?.manualMode) {
        // MODO MANUAL: calcular baseado na porcentagem sobre a base escolhida
        partnerFundValue = activeContracts.reduce((sum, contract) => {
          const baseValue = options.manualBase === 'aporte' 
            ? contract.aporte_value 
            : contract.monthly_cap;
          return sum + (baseValue * (options.manualPercentage / 100));
        }, 0);

        snapshotData = {
          ...snapshotData,
          gross_revenue: 0,
          partner_fund_percentage: 0,
          partner_fund_value: partnerFundValue,
          is_manual: true,
          manual_base: options.manualBase,
          manual_percentage: options.manualPercentage,
          manual_description: options.manualDescription || null
        };
      } else {
        // MODO AUTOMÁTICO: calcular baseado no faturamento
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

        grossRevenue = purchases?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
        partnerFundValue = grossRevenue * (fundPercentage / 100);

        snapshotData = {
          ...snapshotData,
          gross_revenue: grossRevenue,
          partner_fund_percentage: fundPercentage,
          partner_fund_value: partnerFundValue
        };
      }

      // 2. Criar snapshot do mês
      const { error: snapshotError } = await supabase
        .from('monthly_revenue_snapshots')
        .upsert(snapshotData, { onConflict: 'month' });

      if (snapshotError) throw snapshotError;

      // 3. Calcular distribuição para cada contrato
      for (const contract of activeContracts) {
        let calculatedAmount = 0;
        
        if (options?.manualMode) {
          // Modo manual: aplicar porcentagem diretamente sobre a base
          const baseValue = options.manualBase === 'aporte' 
            ? contract.aporte_value 
            : contract.monthly_cap;
          calculatedAmount = baseValue * (options.manualPercentage / 100);
        } else {
          // Modo automático: distribuição proporcional
          const totalAportes = activeContracts.reduce((sum, c) => sum + c.aporte_value, 0);
          const participation = contract.aporte_value / totalAportes;
          calculatedAmount = partnerFundValue * participation;
        }

        let amount = calculatedAmount;
        let monthlyCapApplied = false;
        let totalCapApplied = false;

        // Aplicar limite mensal (apenas no modo manual sobre aporte)
        if (options?.manualMode && options.manualBase === 'aporte' && amount > contract.monthly_cap) {
          amount = contract.monthly_cap;
          monthlyCapApplied = true;
        } else if (!options?.manualMode && amount > contract.monthly_cap) {
          amount = contract.monthly_cap;
          monthlyCapApplied = true;
        }

        // Aplicar teto total
        const remaining = contract.total_cap - contract.total_received;
        if (amount > remaining) {
          amount = Math.max(0, remaining);
          totalCapApplied = true;
        }

        // Só criar repasse se houver valor
        if (amount > 0) {
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

  const [terminations, setTerminations] = useState<any[]>([]);

  const fetchTerminations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partner_early_terminations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTerminations(data || []);
    } catch (error) {
      console.error('Error fetching terminations:', error);
    }
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const { data: withdrawalsData, error } = await supabase
        .from('partner_withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get contract info for each withdrawal
      const contractIds = [...new Set(withdrawalsData?.map(w => w.partner_contract_id) || [])];
      
      if (contractIds.length === 0) {
        setWithdrawals([]);
        return;
      }

      const { data: contractsData } = await supabase
        .from('partner_contracts')
        .select('id, user_id, plan_name')
        .in('id', contractIds);

      const userIds = [...new Set(contractsData?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const contractsMap = new Map(contractsData?.map(c => [c.id, c]) || []);
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const withdrawalsWithUsers = (withdrawalsData || []).map(w => {
        const contract = contractsMap.get(w.partner_contract_id);
        const profile = contract ? profilesMap.get(contract.user_id) : null;
        return {
          ...w,
          payment_details: w.payment_details as PartnerWithdrawalWithUser['payment_details'],
          user_name: profile?.full_name || 'N/A',
          user_email: profile?.email || 'N/A',
          plan_name: contract?.plan_name || 'N/A'
        };
      });

      setWithdrawals(withdrawalsWithUsers);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  }, []);

  const approveWithdrawal = async (withdrawalId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('partner_withdrawals')
        .update({
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      toast({
        title: "Saque aprovado",
        description: "O saque foi aprovado e aguarda pagamento."
      });

      await fetchWithdrawals();
    } catch (error: any) {
      console.error('Error approving withdrawal:', error);
      toast({
        variant: "destructive",
        title: "Erro ao aprovar",
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const rejectWithdrawal = async (withdrawalId: string, reason: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('partner_withdrawals')
        .update({
          status: 'REJECTED',
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      toast({
        title: "Saque rejeitado",
        description: "O saque foi rejeitado."
      });

      await fetchWithdrawals();
    } catch (error: any) {
      console.error('Error rejecting withdrawal:', error);
      toast({
        variant: "destructive",
        title: "Erro ao rejeitar",
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const markWithdrawalAsPaid = async (withdrawalId: string) => {
    setProcessing(true);
    try {
      const withdrawal = withdrawals.find(w => w.id === withdrawalId);
      if (!withdrawal) throw new Error('Saque não encontrado');

      const { error } = await supabase
        .from('partner_withdrawals')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      // Update contract total_withdrawn
      const { data: contractData, error: contractError } = await supabase
        .from('partner_contracts')
        .select('total_withdrawn')
        .eq('id', withdrawal.partner_contract_id)
        .single();

      if (!contractError && contractData) {
        await supabase
          .from('partner_contracts')
          .update({
            total_withdrawn: (contractData.total_withdrawn || 0) + withdrawal.amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', withdrawal.partner_contract_id);
      }

      toast({
        title: "Pagamento confirmado",
        description: "O saque foi marcado como pago."
      });

      await Promise.all([fetchWithdrawals(), fetchContracts()]);
    } catch (error: any) {
      console.error('Error marking withdrawal as paid:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const processTermination = async (terminationId: string, action: 'approve' | 'reject', notes?: string) => {
    setProcessing(true);
    try {
      const termination = terminations.find(t => t.id === terminationId);
      if (!termination) throw new Error('Solicitação não encontrada');

      if (action === 'reject') {
        await supabase
          .from('partner_early_terminations')
          .update({ status: 'REJECTED', admin_notes: notes, processed_at: new Date().toISOString() })
          .eq('id', terminationId);
      } else {
        // Aprovar e encerrar contrato
        await supabase
          .from('partner_early_terminations')
          .update({ status: 'COMPLETED', admin_notes: notes, processed_at: new Date().toISOString(), final_value: termination.proposed_value })
          .eq('id', terminationId);

        await supabase
          .from('partner_contracts')
          .update({ status: 'CLOSED', closed_at: new Date().toISOString(), closed_reason: 'Encerramento antecipado' })
          .eq('id', termination.partner_contract_id);

        // Creditar lances se aplicável
        if (termination.liquidation_type === 'BIDS' && termination.bids_amount > 0) {
          const contract = contracts.find(c => c.id === termination.partner_contract_id);
          if (contract) {
            const { data: profile } = await supabase.from('profiles').select('bids_balance').eq('user_id', contract.user_id).single();
            await supabase.from('profiles').update({ bids_balance: (profile?.bids_balance || 0) + termination.bids_amount }).eq('user_id', contract.user_id);
          }
        }
      }

      toast({ title: action === 'approve' ? 'Encerramento aprovado' : 'Encerramento rejeitado' });
      await Promise.all([fetchContracts(), fetchTerminations()]);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchContracts(), fetchPlans(), fetchPayouts(), fetchSnapshots(), fetchTerminations(), fetchWithdrawals()]);
      setLoading(false);
    };
    loadData();
  }, [fetchContracts, fetchPlans, fetchPayouts, fetchSnapshots, fetchTerminations, fetchWithdrawals]);

  const stats = {
    totalContracts: contracts.length,
    activeContracts: contracts.filter(c => c.status === 'ACTIVE').length,
    totalAportes: contracts.filter(c => c.status === 'ACTIVE').reduce((sum, c) => sum + c.aporte_value, 0),
    totalPaid: contracts.reduce((sum, c) => sum + c.total_received, 0),
    pendingPayouts: payouts.filter(p => p.status === 'PENDING').length,
    pendingTerminations: terminations.filter(t => t.status === 'PENDING').length,
    pendingWithdrawals: withdrawals.filter(w => w.status === 'APPROVED').length
  };

  return {
    contracts,
    plans,
    payouts,
    snapshots,
    terminations,
    withdrawals,
    stats,
    loading,
    processing,
    updateContractStatus,
    updatePlan,
    createPlan,
    deletePlan,
    cancelPayout,
    processMonthlyPayouts,
    markPayoutAsPaid,
    processTermination,
    rejectWithdrawal,
    markWithdrawalAsPaid,
    refreshData: async () => {
      await Promise.all([fetchContracts(), fetchPlans(), fetchPayouts(), fetchSnapshots(), fetchTerminations(), fetchWithdrawals()]);
    }
  };
};
