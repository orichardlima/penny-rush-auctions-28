import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FastStartTier {
  id: string;
  name: string;
  required_referrals: number;
  extra_percentage: number;
  sort_order: number;
}

export interface FastStartAchievement {
  id: string;
  tier_id: string;
  extra_percentage_applied: number;
  total_extra_bonus: number;
  achieved_at: string;
}

export interface FastStartProgressData {
  isInWindow: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  windowEndDate: Date | null;
  contractCreatedAt: string | null;
  currentReferrals: number;
  tiers: FastStartTier[];
  achievements: FastStartAchievement[];
  currentTier: FastStartTier | null;
  nextTier: FastStartTier | null;
  referralsToNextTier: number;
  totalExtraBonus: number;
  loading: boolean;
}

export const useFastStartProgress = (contractId: string | null) => {
  const { profile } = useAuth();
  const [data, setData] = useState<FastStartProgressData>({
    isInWindow: false,
    daysRemaining: 0,
    hoursRemaining: 0,
    windowEndDate: null,
    contractCreatedAt: null,
    currentReferrals: 0,
    tiers: [],
    achievements: [],
    currentTier: null,
    nextTier: null,
    referralsToNextTier: 0,
    totalExtraBonus: 0,
    loading: true,
  });

  const fetchProgress = useCallback(async () => {
    if (!contractId || !profile?.user_id) return;

    try {
      // Fetch contract, tiers, achievements, and referral count in parallel
      const [contractRes, tiersRes, achievementsRes, referralsRes] = await Promise.all([
        supabase
          .from('partner_contracts')
          .select('created_at')
          .eq('id', contractId)
          .single(),
        supabase
          .from('fast_start_tiers')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('fast_start_achievements')
          .select('*')
          .eq('partner_contract_id', contractId)
          .eq('processed', true),
        supabase
          .from('partner_referral_bonuses')
          .select('id')
          .eq('referrer_contract_id', contractId)
          .eq('referral_level', 1)
          .neq('status', 'CANCELLED')
          .eq('is_fast_start_bonus', false),
      ]);

      if (contractRes.error || !contractRes.data) return;

      const contractCreatedAt = contractRes.data.created_at;
      const windowEnd = new Date(contractCreatedAt);
      windowEnd.setDate(windowEnd.getDate() + 30);
      
      const now = new Date();
      const isInWindow = now < windowEnd;
      const diffMs = Math.max(0, windowEnd.getTime() - now.getTime());
      const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hoursRemaining = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      const tiers = (tiersRes.data || []) as FastStartTier[];
      const achievements = (achievementsRes.data || []) as FastStartAchievement[];
      const currentReferrals = referralsRes.data?.length || 0;

      // Determine current and next tier
      const achievedMaxPct = Math.max(0, ...achievements.map(a => a.extra_percentage_applied));
      const sortedTiers = [...tiers].sort((a, b) => a.required_referrals - b.required_referrals);
      
      const currentTier = sortedTiers
        .filter(t => t.required_referrals <= currentReferrals)
        .pop() || null;
      
      const nextTier = sortedTiers
        .find(t => t.required_referrals > currentReferrals) || null;

      const referralsToNextTier = nextTier 
        ? nextTier.required_referrals - currentReferrals 
        : 0;

      const totalExtraBonus = achievements.reduce((sum, a) => sum + a.total_extra_bonus, 0);

      setData({
        isInWindow,
        daysRemaining,
        hoursRemaining,
        windowEndDate: windowEnd,
        contractCreatedAt,
        currentReferrals,
        tiers,
        achievements,
        currentTier,
        nextTier,
        referralsToNextTier,
        totalExtraBonus,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching fast start progress:', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [contractId, profile?.user_id]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return data;
};
