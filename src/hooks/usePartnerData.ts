import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface PartnerContract {
  id: string;
  user_id: string;
  aporte_value: number;
  monthly_cap: number;
  total_cap: number;
  total_received: number;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  plan_name: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_reason: string | null;
}

export interface PartnerPayout {
  id: string;
  partner_contract_id: string;
  month: string;
  calculated_amount: number;
  amount: number;
  monthly_cap_applied: boolean;
  total_cap_applied: boolean;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paid_at: string | null;
  created_at: string;
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
}

export interface ReferralBonus {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  purchase_id: string | null;
  package_value: number;
  bonus_percentage: number;
  bonus_value: number;
  status: 'PENDING' | 'BLOCKED' | 'AVAILABLE' | 'USED';
  available_at: string | null;
  blocked_reason: string | null;
  used_at: string | null;
  created_at: string;
}

export const usePartnerData = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<PartnerContract | null>(null);
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);
  const [plans, setPlans] = useState<PartnerPlan[]>([]);
  const [referralBonuses, setReferralBonuses] = useState<ReferralBonus[]>([]);
  const [totalBonusAvailable, setTotalBonusAvailable] = useState(0);

  const fetchContract = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('partner_contracts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (error) throw error;
      setContract(data as PartnerContract | null);
    } catch (error) {
      console.error('Error fetching partner contract:', error);
    }
  }, [user]);

  const fetchPayouts = useCallback(async () => {
    if (!user || !contract) return;

    try {
      const { data, error } = await supabase
        .from('partner_payouts')
        .select('*')
        .eq('partner_contract_id', contract.id)
        .order('month', { ascending: false });

      if (error) throw error;
      setPayouts((data || []) as PartnerPayout[]);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    }
  }, [user, contract]);

  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partner_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPlans((data || []) as PartnerPlan[]);
    } catch (error) {
      console.error('Error fetching partner plans:', error);
    }
  }, []);

  const fetchReferralBonuses = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('referral_bonuses')
        .select('*')
        .eq('referrer_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const bonuses = (data || []) as ReferralBonus[];
      setReferralBonuses(bonuses);
      
      // Calculate total available bonus
      const available = bonuses
        .filter(b => b.status === 'AVAILABLE')
        .reduce((sum, b) => sum + Number(b.bonus_value), 0);
      setTotalBonusAvailable(available);
    } catch (error) {
      console.error('Error fetching referral bonuses:', error);
    }
  }, [user]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchContract(),
      fetchPlans(),
      fetchReferralBonuses()
    ]);
    setLoading(false);
  }, [fetchContract, fetchPlans, fetchReferralBonuses]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (contract) {
      fetchPayouts();
    }
  }, [contract, fetchPayouts]);

  const isPartner = !!contract;
  const progressPercentage = contract 
    ? Math.min(100, (Number(contract.total_received) / Number(contract.total_cap)) * 100)
    : 0;
  const remainingToTotalCap = contract 
    ? Number(contract.total_cap) - Number(contract.total_received)
    : 0;

  return {
    loading,
    contract,
    payouts,
    plans,
    referralBonuses,
    totalBonusAvailable,
    isPartner,
    progressPercentage,
    remainingToTotalCap,
    refetch: fetchAllData
  };
};
