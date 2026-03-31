import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReferralBonusDetail {
  id: string;
  referrer_name: string;
  referred_name: string;
  plan_name: string;
  aporte_value: number;
  bonus_percentage: number;
  bonus_value: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  referral_level: number;
}

export interface CashflowMovement {
  id: string;
  type: 'entrada' | 'saida';
  category: string;
  description: string;
  partner_name: string;
  amount: number;
  status: string;
  date: string;
}

export interface WeeklyCashflow {
  week: string;
  weekLabel: string;
  entradas: number;
  saidas: number;
  saldo: number;
  saldoAcumulado: number;
}

export interface PartnerCashflowSummary {
  // Entradas
  totalAportes: number;
  totalUpgrades: number;
  totalEntradas: number;
  
  // Saídas
  totalPayoutsPaid: number;
  totalPayoutsPending: number;
  totalWithdrawalsPaid: number;
  totalWithdrawalsPending: number;
  totalReferralBonusesPaid: number;
  totalReferralBonusesPending: number;
  totalSaidas: number;
  totalSaidasPending: number;
  
  // Resumo
  saldoLiquido: number;
  
  // Contadores
  contractsCount: number;
  upgradesCount: number;
  payoutsCount: number;
  withdrawalsCount: number;
  referralBonusesCount: number;
}

export interface PartnerCashflowData {
  summary: PartnerCashflowSummary;
  weeklyFlow: WeeklyCashflow[];
  referralBonuses: ReferralBonusDetail[];
  recentMovements: CashflowMovement[];
}

const getWeekStart = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

const formatWeekLabel = (weekStart: string): string => {
  const date = new Date(weekStart + 'T00:00:00');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
};

export const usePartnerCashflow = (period: '7d' | '30d' | '90d' | 'all' = 'all') => {
  const [data, setData] = useState<PartnerCashflowData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCashflowData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [
        contractsResult,
        upgradesResult,
        payoutsResult,
        withdrawalsResult,
        referralBonusesResult
      ] = await Promise.all([
        supabase.from('partner_contracts').select('id, user_id, aporte_value, plan_name, created_at, status').eq('is_demo', false),
        supabase.from('partner_upgrades').select('id, partner_contract_id, difference_paid, previous_plan_name, new_plan_name, created_at'),
        supabase.from('partner_payouts').select('id, partner_contract_id, amount, status, period_start, paid_at, created_at'),
        supabase.from('partner_withdrawals').select('id, partner_contract_id, amount, status, requested_at, paid_at, created_at'),
        supabase.from('partner_referral_bonuses').select('id, referrer_contract_id, referred_contract_id, referred_user_id, aporte_value, bonus_percentage, bonus_value, status, referral_level, created_at, paid_at')
      ]);

      // Calculate cutoff date based on period
      const getCutoffDate = (): Date | null => {
        if (period === 'all') return null;
        const now = new Date();
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
        now.setDate(now.getDate() - days);
        now.setHours(0, 0, 0, 0);
        return now;
      };
      const cutoffDate = getCutoffDate();
      const isInPeriod = (dateStr: string) => !cutoffDate || new Date(dateStr) >= cutoffDate;

      // Keep ALL contracts for name resolution (independent of period filter)
      const allContracts = contractsResult.data || [];
      const allContractsMap = new Map(allContracts.map(c => [c.id, c]));

      // Filtered data for financial calculations only
      const contracts = allContracts.filter(c => isInPeriod(c.created_at));
      const upgrades = (upgradesResult.data || []).filter(u => isInPeriod(u.created_at));
      const payouts = (payoutsResult.data || []).filter(p => isInPeriod(p.created_at));
      const withdrawals = (withdrawalsResult.data || []).filter(w => isInPeriod(w.created_at));
      const referralBonuses = (referralBonusesResult.data || []).filter(r => isInPeriod(r.created_at));

      // Collect user_ids from ALL contracts (not just filtered) for name resolution
      const userIdSet = new Set<string>();
      allContracts.forEach(c => userIdSet.add(c.user_id));
      referralBonuses.forEach(rb => userIdSet.add(rb.referred_user_id));
      const allUserIds = Array.from(userIdSet);

      // Fetch profiles via RPC (bypasses RLS)
      const profilesMap = new Map<string, string>();
      if (allUserIds.length > 0) {
        const { data: profilesData } = await supabase.rpc('get_public_profiles', { user_ids: allUserIds });
        if (profilesData) {
          (profilesData as Array<{ user_id: string; full_name: string | null }>).forEach(p => {
            profilesMap.set(p.user_id, p.full_name || 'Usuário');
          });
        }
      }

      const totalAportes = contracts.reduce((sum, c) => sum + Number(c.aporte_value || 0), 0);
      const totalUpgrades = upgrades.reduce((sum, u) => sum + Number(u.difference_paid || 0), 0);
      const totalEntradas = totalAportes + totalUpgrades;

      const paidPayouts = payouts.filter(p => p.status === 'PAID');
      const totalPayoutsPaid = paidPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalPayoutsPending = 0;

      const paidWithdrawals = withdrawals.filter(w => w.status === 'PAID' || w.status === 'APPROVED');
      const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING');
      const totalWithdrawalsPaid = paidWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
      const totalWithdrawalsPending = pendingWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);

      const paidReferralBonuses = referralBonuses.filter(r => r.status === 'PAID');
      const pendingReferralBonuses = referralBonuses.filter(r => r.status === 'PENDING' || r.status === 'AVAILABLE');
      const totalReferralBonusesPaid = paidReferralBonuses.reduce((sum, r) => sum + Number(r.bonus_value || 0), 0);
      const totalReferralBonusesPending = pendingReferralBonuses.reduce((sum, r) => sum + Number(r.bonus_value || 0), 0);

      const totalSaidas = totalPayoutsPaid + totalWithdrawalsPaid + totalReferralBonusesPaid;
      const totalSaidasPending = totalPayoutsPending + totalWithdrawalsPending + totalReferralBonusesPending;

      const summary: PartnerCashflowSummary = {
        totalAportes,
        totalUpgrades,
        totalEntradas,
        totalPayoutsPaid,
        totalPayoutsPending,
        totalWithdrawalsPaid,
        totalWithdrawalsPending,
        totalReferralBonusesPaid,
        totalReferralBonusesPending,
        totalSaidas,
        totalSaidasPending,
        saldoLiquido: totalEntradas - totalSaidas,
        contractsCount: contracts.length,
        upgradesCount: upgrades.length,
        payoutsCount: paidPayouts.length,
        withdrawalsCount: paidWithdrawals.length,
        referralBonusesCount: paidReferralBonuses.length
      };

      // Calculate weekly flow
      const weeklyMap = new Map<string, { entradas: number; saidas: number }>();
      const now = new Date();
      const weeksCount = period === '7d' ? 2 : period === '30d' ? 5 : period === '90d' ? 13 : 12;
      
      // Initialize weeks
      for (let i = weeksCount - 1; i >= 0; i--) {
        const weekDate = new Date(now);
        weekDate.setDate(weekDate.getDate() - (i * 7));
        const weekKey = getWeekStart(weekDate);
        weeklyMap.set(weekKey, { entradas: 0, saidas: 0 });
      }

      // Add contracts (entradas)
      contracts.forEach(c => {
        const weekKey = getWeekStart(new Date(c.created_at));
        if (weeklyMap.has(weekKey)) {
          const current = weeklyMap.get(weekKey)!;
          current.entradas += Number(c.aporte_value || 0);
        }
      });

      // Add upgrades (entradas)
      upgrades.forEach(u => {
        const weekKey = getWeekStart(new Date(u.created_at));
        if (weeklyMap.has(weekKey)) {
          const current = weeklyMap.get(weekKey)!;
          current.entradas += Number(u.difference_paid || 0);
        }
      });

      // Add payouts (saidas)
      paidPayouts.forEach(p => {
        const weekKey = getWeekStart(new Date(p.paid_at || p.created_at));
        if (weeklyMap.has(weekKey)) {
          const current = weeklyMap.get(weekKey)!;
          current.saidas += Number(p.amount || 0);
        }
      });

      // Add withdrawals (saidas)
      paidWithdrawals.forEach(w => {
        const weekKey = getWeekStart(new Date(w.paid_at || w.created_at));
        if (weeklyMap.has(weekKey)) {
          const current = weeklyMap.get(weekKey)!;
          current.saidas += Number(w.amount || 0);
        }
      });

      // Add referral bonuses (saidas)
      paidReferralBonuses.forEach(r => {
        const weekKey = getWeekStart(new Date(r.paid_at || r.created_at));
        if (weeklyMap.has(weekKey)) {
          const current = weeklyMap.get(weekKey)!;
          current.saidas += Number(r.bonus_value || 0);
        }
      });

      // Convert to array with accumulated balance
      let saldoAcumulado = 0;
      const weeklyFlow: WeeklyCashflow[] = Array.from(weeklyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, values]) => {
          const saldo = values.entradas - values.saidas;
          saldoAcumulado += saldo;
          return {
            week,
            weekLabel: formatWeekLabel(week),
            entradas: values.entradas,
            saidas: values.saidas,
            saldo,
            saldoAcumulado
          };
        });

      // Build referral bonuses details
      const referralBonusDetails: ReferralBonusDetail[] = referralBonuses.map(rb => {
        const referrerContract = contractsMap.get(rb.referrer_contract_id);
        const referrerName = referrerContract ? profilesMap.get(referrerContract.user_id) || 'Parceiro' : 'Parceiro';
        const referredName = profilesMap.get(rb.referred_user_id) || 'Indicado';
        const referredContract = contractsMap.get(rb.referred_contract_id);
        
        return {
          id: rb.id,
          referrer_name: referrerName,
          referred_name: referredName,
          plan_name: referredContract?.plan_name || 'Plano',
          aporte_value: Number(rb.aporte_value || 0),
          bonus_percentage: Number(rb.bonus_percentage || 0),
          bonus_value: Number(rb.bonus_value || 0),
          status: rb.status,
          created_at: rb.created_at,
          paid_at: rb.paid_at,
          referral_level: rb.referral_level
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Build recent movements (last 50)
      const movements: CashflowMovement[] = [];

      // Add contracts as movements
      contracts.forEach(c => {
        const partnerName = profilesMap.get(c.user_id) || 'Parceiro';
        movements.push({
          id: `contract-${c.id}`,
          type: 'entrada',
          category: 'Aporte Inicial',
          description: `Plano ${c.plan_name}`,
          partner_name: partnerName,
          amount: Number(c.aporte_value || 0),
          status: c.status,
          date: c.created_at
        });
      });

      // Add upgrades as movements
      upgrades.forEach(u => {
        const contract = contractsMap.get(u.partner_contract_id);
        const partnerName = contract ? profilesMap.get(contract.user_id) || 'Parceiro' : 'Parceiro';
        movements.push({
          id: `upgrade-${u.id}`,
          type: 'entrada',
          category: 'Upgrade',
          description: `${u.previous_plan_name} → ${u.new_plan_name}`,
          partner_name: partnerName,
          amount: Number(u.difference_paid || 0),
          status: 'COMPLETED',
          date: u.created_at
        });
      });

      // Add payouts as movements
      payouts.forEach(p => {
        const contract = contractsMap.get(p.partner_contract_id);
        const partnerName = contract ? profilesMap.get(contract.user_id) || 'Parceiro' : 'Parceiro';
        movements.push({
          id: `payout-${p.id}`,
          type: 'saida',
          category: 'Repasse',
          description: `Semana ${formatWeekLabel(p.period_start)}`,
          partner_name: partnerName,
          amount: Number(p.amount || 0),
          status: p.status,
          date: p.paid_at || p.created_at
        });
      });

      // Add withdrawals as movements
      withdrawals.forEach(w => {
        const contract = contractsMap.get(w.partner_contract_id);
        const partnerName = contract ? profilesMap.get(contract.user_id) || 'Parceiro' : 'Parceiro';
        movements.push({
          id: `withdrawal-${w.id}`,
          type: 'saida',
          category: 'Saque',
          description: 'Solicitação de saque',
          partner_name: partnerName,
          amount: Number(w.amount || 0),
          status: w.status,
          date: w.paid_at || w.requested_at
        });
      });

      // Add referral bonuses as movements
      referralBonuses.forEach(rb => {
        const referrerContract = contractsMap.get(rb.referrer_contract_id);
        const partnerName = referrerContract ? profilesMap.get(referrerContract.user_id) || 'Parceiro' : 'Parceiro';
        const referredName = profilesMap.get(rb.referred_user_id) || 'Indicado';
        movements.push({
          id: `referral-${rb.id}`,
          type: 'saida',
          category: 'Bônus Indicação',
          description: `Indicou ${referredName} (Nível ${rb.referral_level})`,
          partner_name: partnerName,
          amount: Number(rb.bonus_value || 0),
          status: rb.status,
          date: rb.paid_at || rb.created_at
        });
      });

      // Sort by date and take last 50
      const recentMovements = movements
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 50);

      setData({
        summary,
        weeklyFlow,
        referralBonuses: referralBonusDetails,
        recentMovements
      });
    } catch (error) {
      console.error('Error fetching partner cashflow data:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchCashflowData();
  }, [fetchCashflowData]);

  return {
    data,
    loading,
    refresh: fetchCashflowData
  };
};
