import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DailyConfigForPreview {
  date: string;
  percentage: number;
  calculation_base: string;
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
  dailyBreakdown: {
    date: string;
    percentage: number;
    baseValue: number;
    dayValue: number;
  }[];
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
  };
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

// Helper to check if contract is eligible for a specific week
const isContractEligibleForWeek = (contractCreatedAt: string, weekStart: string): boolean => {
  const createdDate = new Date(contractCreatedAt);
  createdDate.setHours(0, 0, 0, 0);
  
  const weekStartDate = new Date(weekStart);
  weekStartDate.setHours(0, 0, 0, 0);
  
  // Contract must be created before the week starts
  return createdDate < weekStartDate;
};

export const useDailyPayoutPreview = (selectedWeek: string): DailyPayoutPreviewResult => {
  const [loading, setLoading] = useState(true);
  const [dailyConfigs, setDailyConfigs] = useState<DailyConfigForPreview[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractUpgrades, setContractUpgrades] = useState<Map<string, any[]>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());

  // Calculate week end from week start
  const weekEnd = useMemo(() => {
    const startDate = new Date(selectedWeek);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return endDate.toISOString().split('T')[0];
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
        
        setDailyConfigs(configsData || []);

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

  // Calculate preview for each contract
  const contractPreviews = useMemo((): ContractPayoutPreview[] => {
    if (!dailyConfigs.length || !contracts.length) return [];

    const previews: ContractPayoutPreview[] = [];

    for (const contract of contracts) {
      // Check eligibility
      if (!isContractEligibleForWeek(contract.created_at, selectedWeek)) {
        continue;
      }

      const profile = profiles.get(contract.user_id);
      const upgrades = contractUpgrades.get(contract.id) || [];
      
      const dailyBreakdown: ContractPayoutPreview['dailyBreakdown'] = [];
      let totalCalculated = 0;
      let weeklyCapApplied = false;

      for (const config of dailyConfigs) {
        const configDate = new Date(config.date);
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
          dayValue
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
        dailyBreakdown
      });
    }

    return previews.sort((a, b) => b.finalAmount - a.finalAmount);
  }, [dailyConfigs, contracts, contractUpgrades, profiles, selectedWeek]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalPercentage = dailyConfigs.reduce((sum, c) => sum + Number(c.percentage), 0);
    const totalCalculated = contractPreviews.reduce((sum, p) => sum + p.calculatedAmount, 0);
    const totalFinal = contractPreviews.reduce((sum, p) => sum + p.finalAmount, 0);
    const contractsWithCap = contractPreviews.filter(p => p.weeklyCapApplied || p.totalCapApplied).length;

    return {
      totalPercentage,
      totalCalculated,
      totalFinal,
      eligibleContracts: contractPreviews.length,
      contractsWithCap
    };
  }, [dailyConfigs, contractPreviews]);

  const calculationBase = dailyConfigs[0]?.calculation_base || 'aporte';

  return {
    loading,
    dailyConfigs,
    contractPreviews,
    totals,
    hasConfigs: dailyConfigs.length > 0,
    calculationBase
  };
};
