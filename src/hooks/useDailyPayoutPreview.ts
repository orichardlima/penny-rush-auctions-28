import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DailyConfigForPreview {
  date: string;
  percentage: number;
  calculation_base: string;
}

interface DailyBreakdownItem {
  date: string;
  percentage: number;
  baseValue: number;
  dayValue: number;
  skipped: boolean;
  skipReason?: string;
}

interface ContractPayoutPreview {
  contractId: string;
  userId: string;
  userName: string;
  userEmail: string;
  planName: string;
  aporteValue: number;
  weeklyCap: number;
  totalCap: number;
  totalReceived: number;
  remainingCap: number;
  calculatedAmount: number;
  finalAmount: number;
  weeklyCapApplied: boolean;
  totalCapApplied: boolean;
  eligibleFrom: string | null;
  eligibleDays: number;
  proRataApplied: boolean;
  dailyBreakdown: DailyBreakdownItem[];
}

interface PlanTotal {
  planName: string;
  count: number;
  calculated: number;
  final: number;
  proRataCount: number;
  cappedCount: number;
}

interface DailyPayoutPreviewResult {
  loading: boolean;
  dailyConfigs: DailyConfigForPreview[];
  contractPreviews: ContractPayoutPreview[];
  totals: {
    totalPercentage: number;
    totalCalculated: number;
    totalFinal: number;
    eligibleContracts: number;
    contractsWithCap: number;
    contractsWithProRata: number;
  };
  totalsByPlan: PlanTotal[];
  hasConfigs: boolean;
  calculationBase: string;
}

// Helper function to get contract values at a specific date
const getValuesAtDate = (
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

// Helper: Format a Date to YYYY-MM-DD string using local time
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Parse YYYY-MM-DD string to local Date
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

// PRO RATA: Get eligible days for a contract in a given week
interface ContractEligibility {
  eligible: boolean;
  eligibleFrom: Date | null;
  eligibleDays: number;
  reason: string;
  isProRata: boolean;
}

const getContractEligibleDays = (
  contractCreatedAt: string,
  weekStart: string,
  weekEnd: string
): ContractEligibility => {
  const createdDate = new Date(contractCreatedAt);
  createdDate.setHours(0, 0, 0, 0);
  
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

export const useDailyPayoutPreview = (selectedWeek: string): DailyPayoutPreviewResult => {
  const [loading, setLoading] = useState(true);
  const [dailyConfigs, setDailyConfigs] = useState<DailyConfigForPreview[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractUpgrades, setContractUpgrades] = useState<Map<string, any[]>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());

  // Calculate week end from week start using local date parsing
  const weekEnd = useMemo(() => {
    const startDate = parseLocalDate(selectedWeek);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return formatLocalDate(endDate);
  }, [selectedWeek]);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedWeek) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Fetch daily configs for the week
        const { data: configsData, error: configsError } = await supabase
          .from('daily_revenue_config')
          .select('date, percentage, calculation_base')
          .gte('date', selectedWeek)
          .lte('date', weekEnd)
          .order('date', { ascending: true });

        if (configsError) throw configsError;
        
        // Create map of existing configs
        const configsMap = new Map<string, DailyConfigForPreview>();
        (configsData || []).forEach(c => {
          configsMap.set(c.date, {
            date: c.date,
            percentage: Number(c.percentage),
            calculation_base: c.calculation_base
          });
        });

        // Generate all 7 days of the week
        const allDaysConfigs: DailyConfigForPreview[] = [];
        // Parse the date string as local time (not UTC) to avoid timezone issues
        const [year, month, day] = selectedWeek.split('-').map(Number);
        const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        const defaultBase = configsData?.[0]?.calculation_base || 'aporte';

        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(startDate);
          dayDate.setDate(startDate.getDate() + i);
          // Format as YYYY-MM-DD using local time
          const dayKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
          
          // Use existing config or create with 0%
          const existingConfig = configsMap.get(dayKey);
          allDaysConfigs.push(existingConfig || {
            date: dayKey,
            percentage: 0,
            calculation_base: defaultBase
          });
        }

        setDailyConfigs(allDaysConfigs);

        // Fetch active contracts
        const { data: contractsData, error: contractsError } = await supabase
          .from('partner_contracts')
          .select('*')
          .eq('status', 'ACTIVE');

        if (contractsError) throw contractsError;
        setContracts(contractsData || []);

        // Fetch all upgrades for active contracts
        if (contractsData && contractsData.length > 0) {
          const contractIds = contractsData.map(c => c.id);
          const { data: upgradesData, error: upgradesError } = await supabase
            .from('partner_upgrades')
            .select('partner_contract_id, previous_aporte_value, previous_weekly_cap, new_aporte_value, new_weekly_cap, created_at')
            .in('partner_contract_id', contractIds)
            .order('created_at', { ascending: true });

          if (upgradesError) throw upgradesError;

          const upgradesMap = new Map<string, any[]>();
          upgradesData?.forEach(upgrade => {
            const existing = upgradesMap.get(upgrade.partner_contract_id) || [];
            existing.push(upgrade);
            upgradesMap.set(upgrade.partner_contract_id, existing);
          });
          setContractUpgrades(upgradesMap);

          // Fetch profiles for user names
          const userIds = contractsData.map(c => c.user_id);
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);

          if (profilesError) throw profilesError;

          const profilesMap = new Map<string, any>();
          profilesData?.forEach(profile => {
            profilesMap.set(profile.user_id, profile);
          });
          setProfiles(profilesMap);
        }
      } catch (error) {
        console.error('Error fetching daily payout preview data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedWeek, weekEnd]);

  // Calculate preview for each contract with Pro Rata support
  const contractPreviews = useMemo((): ContractPayoutPreview[] => {
    if (!dailyConfigs.length || !contracts.length) return [];

    const previews: ContractPayoutPreview[] = [];

    for (const contract of contracts) {
      // Check Pro Rata eligibility
      const eligibility = getContractEligibleDays(contract.created_at, selectedWeek, weekEnd);
      
      if (!eligibility.eligible) {
        continue;
      }

      const profile = profiles.get(contract.user_id);
      const upgrades = contractUpgrades.get(contract.id) || [];
      
      const dailyBreakdown: DailyBreakdownItem[] = [];
      let totalCalculated = 0;
      let weeklyCapApplied = false;

      for (const config of dailyConfigs) {
        const configDate = parseLocalDate(config.date);
        
        // PRO RATA: Skip days before the contract was created
        if (eligibility.eligibleFrom && configDate < eligibility.eligibleFrom) {
          dailyBreakdown.push({
            date: config.date,
            percentage: Number(config.percentage),
            baseValue: 0,
            dayValue: 0,
            skipped: true,
            skipReason: 'Não cadastrado'
          });
          continue;
        }
        
        const valuesAtDate = getValuesAtDate(contract, upgrades, configDate);
        const baseValue = config.calculation_base === 'weekly_cap' 
          ? valuesAtDate.weeklyCap 
          : valuesAtDate.aporte;
        
        let dayValue = baseValue * (Number(config.percentage) / 100);
        
        // Apply weekly cap if base is aporte
        if (config.calculation_base === 'aporte' && dayValue > valuesAtDate.weeklyCap) {
          dayValue = valuesAtDate.weeklyCap;
          weeklyCapApplied = true;
        }

        dailyBreakdown.push({
          date: config.date,
          percentage: Number(config.percentage),
          baseValue,
          dayValue,
          skipped: false
        });

        totalCalculated += dayValue;
      }

      // Apply total cap
      const remainingCap = contract.total_cap - contract.total_received;
      let finalAmount = totalCalculated;
      let totalCapApplied = false;
      
      if (finalAmount > remainingCap) {
        finalAmount = Math.max(0, remainingCap);
        totalCapApplied = true;
      }

      previews.push({
        contractId: contract.id,
        userId: contract.user_id,
        userName: profile?.full_name || 'N/A',
        userEmail: profile?.email || '',
        planName: contract.plan_name,
        aporteValue: contract.aporte_value,
        weeklyCap: contract.weekly_cap,
        totalCap: contract.total_cap,
        totalReceived: contract.total_received,
        remainingCap,
        calculatedAmount: totalCalculated,
        finalAmount,
        weeklyCapApplied,
        totalCapApplied,
        eligibleFrom: eligibility.eligibleFrom ? formatLocalDate(eligibility.eligibleFrom) : null,
        eligibleDays: eligibility.eligibleDays,
        proRataApplied: eligibility.isProRata,
        dailyBreakdown
      });
    }

    return previews.sort((a, b) => b.finalAmount - a.finalAmount);
  }, [dailyConfigs, contracts, contractUpgrades, profiles, selectedWeek, weekEnd]);

  // Calculate totals including Pro Rata count
  const totals = useMemo(() => {
    const totalPercentage = dailyConfigs.reduce((sum, c) => sum + Number(c.percentage), 0);
    const totalCalculated = contractPreviews.reduce((sum, p) => sum + p.calculatedAmount, 0);
    const totalFinal = contractPreviews.reduce((sum, p) => sum + p.finalAmount, 0);
    const contractsWithCap = contractPreviews.filter(p => p.weeklyCapApplied || p.totalCapApplied).length;
    const contractsWithProRata = contractPreviews.filter(p => p.proRataApplied).length;

    return {
      totalPercentage,
      totalCalculated,
      totalFinal,
      eligibleContracts: contractPreviews.length,
      contractsWithCap,
      contractsWithProRata
    };
  }, [dailyConfigs, contractPreviews]);

  // Calculate totals by plan type
  const totalsByPlan = useMemo((): PlanTotal[] => {
    const planTotals: { [planName: string]: { 
      count: number; 
      calculated: number; 
      final: number;
      proRataCount: number;
      cappedCount: number;
    }} = {};

    for (const preview of contractPreviews) {
      if (!planTotals[preview.planName]) {
        planTotals[preview.planName] = { 
          count: 0, 
          calculated: 0, 
          final: 0,
          proRataCount: 0,
          cappedCount: 0
        };
      }
      planTotals[preview.planName].count++;
      planTotals[preview.planName].calculated += preview.calculatedAmount;
      planTotals[preview.planName].final += preview.finalAmount;
      if (preview.proRataApplied) planTotals[preview.planName].proRataCount++;
      if (preview.totalCapApplied || preview.weeklyCapApplied) planTotals[preview.planName].cappedCount++;
    }

    return Object.entries(planTotals).map(([name, data]) => ({
      planName: name,
      ...data
    })).sort((a, b) => b.final - a.final);
  }, [contractPreviews]);

  const calculationBase = dailyConfigs[0]?.calculation_base || 'aporte';

  return {
    loading,
    dailyConfigs,
    contractPreviews,
    totals,
    totalsByPlan,
    hasConfigs: dailyConfigs.length > 0,
    calculationBase
  };
};
