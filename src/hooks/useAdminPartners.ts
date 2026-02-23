import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PartnerContractWithUser {
  id: string;
  user_id: string;
  plan_name: string;
  aporte_value: number;
  weekly_cap: number;
  total_cap: number;
  total_received: number;
  bonus_bids_received: number;
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
  weekly_cap: number;
  total_cap: number;
  is_active: boolean;
  sort_order: number;
  referral_bonus_percentage?: number;
  bonus_bids?: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyRevenueSnapshot {
  id: string;
  period_start: string;
  period_end: string | null;
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

// Helper: Format a Date to YYYY-MM-DD string using local time (avoids UTC issues)
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Parse YYYY-MM-DD string to local Date (avoids UTC issues)
export const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

// Helper: Get the Monday of the week for a given date
export const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Normalize time to midnight
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0); // Ensure midnight
  return monday;
};

// Helper: Get the Sunday of the week for a given date
export const getWeekEnd = (date: Date): Date => {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(0, 0, 0, 0);
  return weekEnd;
};

// Helper: Format a week range for display
export const formatWeekRange = (periodStart: string, periodEnd?: string | null): string => {
  // Parse as local date to avoid UTC offset issues
  const start = parseLocalDate(periodStart);
  const end = periodEnd ? parseLocalDate(periodEnd) : getWeekEnd(start);
  
  const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const year = start.getFullYear();
  
  return `${formatDate(start)} - ${formatDate(end)}/${year}`;
};

export type WeekOption = { 
  value: string; 
  label: string; 
  start: Date; 
  end: Date; 
  isCurrentWeek: boolean;
  monthKey: string;
};

export type WeeksByMonth = {
  monthKey: string;
  monthLabel: string;
  weeks: WeekOption[];
};

// Helper: Get list of weeks for selection (last N weeks)
export const getWeekOptions = (numWeeks: number = 12): WeekOption[] => {
  const weeks: WeekOption[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < numWeeks; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (i * 7));
    const weekStart = getWeekStart(d);
    const weekEnd = getWeekEnd(weekStart);
    
    // Use local date formatting to avoid UTC shift
    const value = formatLocalDate(weekStart);
    const label = formatWeekRange(value, formatLocalDate(weekEnd));
    const monthKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
    
    weeks.push({ value, label, start: weekStart, end: weekEnd, isCurrentWeek: i === 0, monthKey });
  }
  
  return weeks;
};

// Helper: Group weeks by month
export const getWeeksGroupedByMonth = (numWeeks: number = 12): WeeksByMonth[] => {
  const weeks = getWeekOptions(numWeeks);
  const monthsMap = new Map<string, WeeksByMonth>();
  
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  for (const week of weeks) {
    if (!monthsMap.has(week.monthKey)) {
      const [year, month] = week.monthKey.split('-');
      const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
      monthsMap.set(week.monthKey, { monthKey: week.monthKey, monthLabel, weeks: [] });
    }
    monthsMap.get(week.monthKey)!.weeks.push(week);
  }
  
  return Array.from(monthsMap.values());
};

export interface ManualPayoutOptions {
  manualMode: boolean;
  manualBase: 'aporte' | 'weekly_cap';
  manualPercentage: number;
  manualDescription?: string;
  useDailyConfig?: boolean;
}

// Helper function to get contract values at a specific date considering upgrades
export const getValuesAtDate = (
  contract: { aporte_value: number; weekly_cap: number },
  upgrades: Array<{
    previous_aporte_value: number;
    previous_weekly_cap: number;
    new_aporte_value: number;
    new_weekly_cap: number;
    created_at: string;
  }>,
  date: Date
): { aporte: number; weeklyCap: number } => {
  if (!upgrades || upgrades.length === 0) {
    return { aporte: contract.aporte_value, weeklyCap: contract.weekly_cap };
  }
  
  // Start with the first upgrade's previous values (initial contract values)
  let aporte = upgrades[0].previous_aporte_value;
  let weeklyCap = upgrades[0].previous_weekly_cap;
  
  for (const upgrade of upgrades) {
    const upgradeDate = new Date(upgrade.created_at);
    upgradeDate.setHours(0, 0, 0, 0);
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    if (checkDate >= upgradeDate) {
      aporte = upgrade.new_aporte_value;
      weeklyCap = upgrade.new_weekly_cap;
    }
  }
  
  return { aporte, weeklyCap };
};

// PRO RATA: Get eligible days for a contract in a given week
// Returns the number of days the contract was active and from which date
export interface ContractEligibility {
  eligible: boolean;
  eligibleFrom: Date | null;
  eligibleDays: number;
  reason: string;
  isProRata: boolean;
}

export const getContractEligibleDays = (
  contractCreatedAt: string,
  weekStart: string,
  weekEnd: string
): ContractEligibility => {
  const createdDate = new Date(contractCreatedAt);
  createdDate.setHours(0, 0, 0, 0);
  
  // Parse dates as local to avoid UTC issues
  const weekStartDate = parseLocalDate(weekStart);
  const weekEndDate = parseLocalDate(weekEnd);
  
  // If created after the week ends = not eligible
  if (createdDate > weekEndDate) {
    return { 
      eligible: false, 
      eligibleFrom: null, 
      eligibleDays: 0, 
      reason: 'Cadastro após a semana',
      isProRata: false
    };
  }
  
  // If created before the week starts = full 7 days
  if (createdDate < weekStartDate) {
    return { 
      eligible: true, 
      eligibleFrom: weekStartDate, 
      eligibleDays: 7, 
      reason: 'Semana completa',
      isProRata: false
    };
  }
  
  // Created during the week = Pro Rata
  // Calculate days from creation to end of week (inclusive)
  const msPerDay = 1000 * 60 * 60 * 24;
  const eligibleDays = Math.floor((weekEndDate.getTime() - createdDate.getTime()) / msPerDay) + 1;
  
  return { 
    eligible: true, 
    eligibleFrom: createdDate, 
    eligibleDays: Math.min(7, Math.max(1, eligibleDays)), 
    reason: `Pro Rata: ${eligibleDays}/7 dias`,
    isProRata: true
  };
};

// Legacy function for backward compatibility - now uses Pro Rata logic
export const isContractEligibleForWeek = (
  contractCreatedAt: string,
  weekStart: string
): { eligible: boolean; reason: string } => {
  const weekStartDate = parseLocalDate(weekStart);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = formatLocalDate(weekEndDate);
  
  const result = getContractEligibleDays(contractCreatedAt, weekStart, weekEnd);
  return { eligible: result.eligible, reason: result.reason };
};

export interface PartnerPayoutWithContract {
  id: string;
  partner_contract_id: string;
  period_start: string;
  period_end: string | null;
  calculated_amount: number;
  amount: number;
  status: string;
  weekly_cap_applied: boolean;
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
  const [snapshots, setSnapshots] = useState<WeeklyRevenueSnapshot[]>([]);
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
        .order('period_start', { ascending: false })
        .limit(100);

      if (error) throw error;
      setPayouts((data || []) as PartnerPayoutWithContract[]);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    }
  }, []);

  const fetchSnapshots = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_revenue_snapshots')
        .select('*')
        .order('period_start', { ascending: false });

      if (error) throw error;
      setSnapshots((data || []) as WeeklyRevenueSnapshot[]);
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

  const processWeeklyPayouts = async (weekStart: string, fundPercentage: number, options?: ManualPayoutOptions) => {
    setProcessing(true);
    try {
      const weekStartDate = parseLocalDate(weekStart);
      const weekEndDate = getWeekEnd(weekStartDate);
      const weekEnd = formatLocalDate(weekEndDate);

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

      // PRO RATA: Filter contracts by eligibility (contracts created during week get Pro Rata)
      const contractsWithEligibility = allActiveContracts.map(contract => {
        const eligibility = getContractEligibleDays(contract.created_at, weekStart, weekEnd);
        return { ...contract, eligibility };
      });
      
      const activeContracts = contractsWithEligibility.filter(c => c.eligibility.eligible);

      if (activeContracts.length === 0) {
        toast({
          title: "Sem contratos elegíveis",
          description: `Nenhum contrato é elegível para a semana selecionada.`
        });
        setProcessing(false);
        return;
      }

      const proRataCount = activeContracts.filter(c => c.eligibility.isProRata).length;
      if (proRataCount > 0) {
        console.log(`${proRataCount} contrato(s) com Pro Rata nesta semana`);
      }

      let grossRevenue = 0;
      let partnerFundValue = 0;
      let snapshotData: any = {
        period_start: weekStart,
        period_end: weekEnd,
        is_manual: false,
        manual_base: null,
        manual_percentage: null,
        manual_description: null
      };

      // Estrutura para armazenar cálculos por contrato (usado no modo diário)
      const contractPayouts: Map<string, { calculatedAmount: number; weeklyCapApplied: boolean }> = new Map();

      if (options?.useDailyConfig) {
        // MODO FATURAMENTO DIÁRIO: usar configurações diárias da tabela daily_revenue_config
        const { data: dailyConfigs, error: configError } = await supabase
          .from('daily_revenue_config')
          .select('date, percentage, calculation_base')
          .gte('date', weekStart)
          .lte('date', weekEnd)
          .order('date', { ascending: true });

        if (configError) throw configError;

        if (!dailyConfigs || dailyConfigs.length === 0) {
          toast({
            variant: "destructive",
            title: "Sem configurações diárias",
            description: "Configure o faturamento diário para esta semana antes de processar."
          });
          setProcessing(false);
          return;
        }

        // Calcular porcentagem total da semana e determinar base
        const totalWeekPercentage = dailyConfigs.reduce((sum, c) => sum + Number(c.percentage || 0), 0);
        const calculationBase = dailyConfigs[0]?.calculation_base || 'aporte';

        // Processar cada contrato individualmente com Pro Rata
        for (const contract of activeContracts) {
          // Buscar upgrades do contrato para considerar valores históricos
          const { data: upgrades } = await supabase
            .from('partner_upgrades')
            .select('previous_aporte_value, previous_weekly_cap, new_aporte_value, new_weekly_cap, created_at')
            .eq('partner_contract_id', contract.id)
            .order('created_at', { ascending: true });

          let totalCalculated = 0;
          let wasWeeklyCapApplied = false;

          // Calcular valor para cada dia configurado
          for (const config of dailyConfigs) {
            const configDate = parseLocalDate(config.date);
            
            // PRO RATA: Skip days before the contract was created
            if (contract.eligibility.eligibleFrom && configDate < contract.eligibility.eligibleFrom) {
              continue;
            }
            
            const valuesAtDate = getValuesAtDate(contract, upgrades || [], configDate);
            const baseValue = config.calculation_base === 'weekly_cap' 
              ? valuesAtDate.weeklyCap 
              : valuesAtDate.aporte;
            
            let dayValue = baseValue * (Number(config.percentage) / 100);
            
            // Aplicar weekly cap se base for aporte
            if (config.calculation_base === 'aporte' && dayValue > valuesAtDate.weeklyCap) {
              dayValue = valuesAtDate.weeklyCap;
              wasWeeklyCapApplied = true;
            }
            
            totalCalculated += dayValue;
          }

          contractPayouts.set(contract.id, { 
            calculatedAmount: totalCalculated, 
            weeklyCapApplied: wasWeeklyCapApplied 
          });
          partnerFundValue += totalCalculated;
        }

        snapshotData = {
          ...snapshotData,
          gross_revenue: 0,
          partner_fund_percentage: 0,
          partner_fund_value: partnerFundValue,
          is_manual: true,
          manual_base: calculationBase,
          manual_percentage: totalWeekPercentage,
          manual_description: `Faturamento Diário: ${dailyConfigs.length} dia(s) configurado(s)${proRataCount > 0 ? ` • ${proRataCount} Pro Rata` : ''}`
        };

      } else if (options?.manualMode) {
        // MODO MANUAL: calcular baseado na porcentagem sobre a base escolhida
        partnerFundValue = activeContracts.reduce((sum, contract) => {
          const baseValue = options.manualBase === 'aporte' 
            ? contract.aporte_value 
            : contract.weekly_cap;
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
        // MODO AUTOMÁTICO: calcular baseado no faturamento da semana
        const { data: purchases, error: purchasesError } = await supabase
          .from('bid_purchases')
          .select('amount_paid')
          .eq('payment_status', 'completed')
          .gte('created_at', `${formatLocalDate(weekStartDate)}T00:00:00-03:00`)
          .lt('created_at', `${formatLocalDate(new Date(weekEndDate.getTime() + 86400000))}T00:00:00-03:00`); // +1 day to include the full end date

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

      // 2. Criar snapshot da semana
      const { error: snapshotError } = await supabase
        .from('weekly_revenue_snapshots')
        .upsert(snapshotData, { onConflict: 'period_start' });

      if (snapshotError) throw snapshotError;

      // 3. Calcular distribuição para cada contrato
      for (const contract of activeContracts) {
        let calculatedAmount = 0;
        let preCalculatedWeeklyCapApplied = false;
        
        if (options?.useDailyConfig) {
          // Modo diário: usar valores já calculados
          const preCalc = contractPayouts.get(contract.id);
          calculatedAmount = preCalc?.calculatedAmount || 0;
          preCalculatedWeeklyCapApplied = preCalc?.weeklyCapApplied || false;
        } else if (options?.manualMode) {
          // Modo manual: aplicar porcentagem diretamente sobre a base
          const baseValue = options.manualBase === 'aporte' 
            ? contract.aporte_value 
            : contract.weekly_cap;
          calculatedAmount = baseValue * (options.manualPercentage / 100);
        } else {
          // Modo automático: distribuição proporcional
          const totalAportes = activeContracts.reduce((sum, c) => sum + c.aporte_value, 0);
          const participation = contract.aporte_value / totalAportes;
          calculatedAmount = partnerFundValue * participation;
        }

        let amount = calculatedAmount;
        let weeklyCapApplied = preCalculatedWeeklyCapApplied;
        let totalCapApplied = false;

        // Aplicar limite semanal (exceto para modo diário onde já foi aplicado por dia)
        if (!options?.useDailyConfig && amount > contract.weekly_cap) {
          amount = contract.weekly_cap;
          weeklyCapApplied = true;
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
              period_start: weekStart,
              period_end: weekEnd,
              calculated_amount: calculatedAmount,
              amount: amount,
              status: 'PAID',
              paid_at: new Date().toISOString(),
              weekly_cap_applied: weeklyCapApplied,
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
        description: `${activeContracts.length} contratos processados para a semana ${formatWeekRange(weekStart, weekEnd)}`
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
        const contract = contracts.find(c => c.id === termination.partner_contract_id);
        if (!contract) throw new Error('Contrato não encontrado');

        // Validar se contrato já está fechado
        if (contract.status === 'CLOSED') {
          throw new Error('Este contrato já foi encerrado anteriormente. A solicitação será rejeitada automaticamente.');
        }

        // Verificar se já existe solicitação COMPLETED para este contrato
        const { data: existingCompleted } = await supabase
          .from('partner_early_terminations')
          .select('id')
          .eq('partner_contract_id', termination.partner_contract_id)
          .eq('status', 'COMPLETED')
          .neq('id', terminationId)
          .limit(1)
          .maybeSingle();

        if (existingCompleted) {
          throw new Error('Já existe um encerramento processado para este contrato.');
        }

        // Buscar saldo atual de lances do usuário
        const { data: profileData } = await supabase
          .from('profiles')
          .select('bids_balance')
          .eq('user_id', contract.user_id)
          .single();

        const currentBalance = profileData?.bids_balance || 0;
        const bonusBidsToExpire = contract.bonus_bids_received || 0;

        // Calcular novo saldo: subtrair bônus expirado (não pode ficar negativo)
        let newBalance = Math.max(0, currentBalance - bonusBidsToExpire);

        // Se liquidação for em BIDS, adicionar os lances da liquidação
        if (termination.liquidation_type === 'BIDS' && termination.bids_amount > 0) {
          newBalance += termination.bids_amount;
        }

        // Atualizar saldo do usuário
        await supabase
          .from('profiles')
          .update({ bids_balance: newBalance })
          .eq('user_id', contract.user_id);

        // Atualizar status da solicitação de encerramento
        await supabase
          .from('partner_early_terminations')
          .update({ status: 'COMPLETED', admin_notes: notes, processed_at: new Date().toISOString(), final_value: termination.proposed_value })
          .eq('id', terminationId);

        // Encerrar contrato
        await supabase
          .from('partner_contracts')
          .update({ status: 'CLOSED', closed_at: new Date().toISOString(), closed_reason: 'Encerramento antecipado' })
          .eq('id', termination.partner_contract_id);
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
    pendingPayouts: 0,
    pendingTerminations: terminations.filter(t => t.status === 'PENDING').length,
    pendingWithdrawals: withdrawals.filter(w => w.status === 'APPROVED').length
  };

  // Corrigir bônus de lances não expirados para contratos já encerrados
  const correctBonusBids = async (contract: PartnerContractWithUser): Promise<boolean> => {
    if (contract.status !== 'CLOSED') {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Apenas contratos encerrados podem ter o bônus corrigido.'
      });
      return false;
    }

    const bonusToDeduct = contract.bonus_bids_received || 0;
    if (bonusToDeduct === 0) {
      toast({
        title: 'Nenhuma correção necessária',
        description: 'Este contrato não tem bônus de lances pendente.'
      });
      return false;
    }

    setProcessing(true);
    try {
      // Buscar saldo atual do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('bids_balance, full_name')
        .eq('user_id', contract.user_id)
        .single();

      if (profileError) throw profileError;

      const currentBalance = profile?.bids_balance || 0;
      const newBalance = Math.max(0, currentBalance - bonusToDeduct);

      // Atualizar saldo de lances
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', contract.user_id);

      if (updateProfileError) throw updateProfileError;

      // Zerar bonus_bids_received para indicar que foi corrigido
      const { error: updateContractError } = await supabase
        .from('partner_contracts')
        .update({ bonus_bids_received: 0 })
        .eq('id', contract.id);

      if (updateContractError) throw updateContractError;

      // Registrar na auditoria
      await supabase.rpc('log_admin_action', {
        p_action_type: 'bonus_correction',
        p_target_type: 'partner_contract',
        p_target_id: contract.id,
        p_description: `Correção retroativa de ${bonusToDeduct} lances bônus do contrato ${contract.plan_name}`,
        p_old_values: { bids_balance: currentBalance, bonus_bids_received: bonusToDeduct },
        p_new_values: { bids_balance: newBalance, bonus_bids_received: 0 }
      });

      toast({
        title: 'Bônus corrigido com sucesso',
        description: `Descontados ${bonusToDeduct} lances. Novo saldo: ${newBalance} lances.`
      });

      await fetchContracts();
      return true;
    } catch (error: any) {
      console.error('Erro ao corrigir bônus:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao corrigir bônus',
        description: error.message
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Add manual credit to partner's available balance
  const addManualCredit = async (
    contractId: string, 
    amount: number, 
    description: string,
    creditType: 'bonus' | 'correction' | 'compensation' | 'other',
    consumesCap: boolean = true
  ) => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Admin não autenticado');

      const contract = contracts.find(c => c.id === contractId);
      if (!contract) throw new Error('Contrato não encontrado');
      
      if (contract.status !== 'ACTIVE') {
        throw new Error('Apenas contratos ativos podem receber créditos');
      }

      if (amount <= 0) {
        throw new Error('O valor deve ser maior que zero');
      }

      if (!description.trim()) {
        throw new Error('Informe o motivo do crédito');
      }

      // 1. Register manual credit in the history table with consumes_cap flag
      const { error: creditError } = await supabase
        .from('partner_manual_credits')
        .insert({
          partner_contract_id: contractId,
          amount,
          description: description.trim(),
          credit_type: creditType,
          created_by: user.id,
          consumes_cap: consumesCap
        });

      if (creditError) throw creditError;

      // 2. Create a PAID payout to make the balance immediately available
      const today = formatLocalDate(new Date());
      const { error: payoutError } = await supabase
        .from('partner_payouts')
        .insert({
          partner_contract_id: contractId,
          period_start: today,
          period_end: today,
          calculated_amount: amount,
          amount: amount,
          status: 'PAID',
          paid_at: new Date().toISOString(),
          weekly_cap_applied: false,
          total_cap_applied: false
        });

      if (payoutError) throw payoutError;

      // 3. Update total_received on the contract ONLY if consumesCap is true
      if (consumesCap) {
        const { error: updateError } = await supabase
          .from('partner_contracts')
          .update({
            total_received: contract.total_received + amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', contractId);

        if (updateError) throw updateError;
      }

      const bonusText = consumesCap ? '' : ' (bônus extra, não consome do teto)';
      toast({
        title: "Crédito adicionado!",
        description: `R$ ${amount.toFixed(2)} creditado com sucesso para ${contract.user_name || 'o parceiro'}${bonusText}.`
      });

      await Promise.all([fetchContracts(), fetchPayouts()]);
    } catch (error: any) {
      console.error('Error adding manual credit:', error);
      toast({
        variant: "destructive",
        title: "Erro ao adicionar crédito",
        description: error.message || "Não foi possível adicionar o crédito."
      });
    } finally {
      setProcessing(false);
    }
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
    processWeeklyPayouts,
    markPayoutAsPaid,
    processTermination,
    rejectWithdrawal,
    markWithdrawalAsPaid,
    correctBonusBids,
    addManualCredit,
    refreshData: async () => {
      await Promise.all([fetchContracts(), fetchPlans(), fetchPayouts(), fetchSnapshots(), fetchTerminations(), fetchWithdrawals()]);
    }
  };
};
