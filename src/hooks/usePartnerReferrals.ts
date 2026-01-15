import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface PartnerReferralBonus {
  id: string;
  referrer_contract_id: string;
  referred_contract_id: string;
  referred_user_id: string;
  aporte_value: number;
  bonus_percentage: number;
  bonus_value: number;
  referral_level: number;
  status: 'PENDING' | 'AVAILABLE' | 'PAID' | 'CANCELLED';
  available_at: string | null;
  paid_at: string | null;
  created_at: string;
  referred_user_name?: string;
  referred_plan_name?: string;
  points_earned?: number;
}

export interface ReferralLevelConfig {
  id: string;
  level: number;
  percentage: number;
  is_active: boolean;
  description: string | null;
}

export interface BinaryPoints {
  leftPoints: number;
  rightPoints: number;
  weakerLegPoints: number;
}

export const usePartnerReferrals = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [bonuses, setBonuses] = useState<PartnerReferralBonus[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [binaryPoints, setBinaryPoints] = useState<BinaryPoints>({
    leftPoints: 0,
    rightPoints: 0,
    weakerLegPoints: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchReferralData = useCallback(async () => {
    if (!profile?.user_id) return;

    try {
      // Get user's active contract with referral code and points
      const { data: contractData, error: contractError } = await supabase
        .from('partner_contracts')
        .select('id, referral_code, total_referral_points')
        .eq('user_id', profile.user_id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (contractError) throw contractError;

      if (contractData) {
        setContractId(contractData.id);
        setReferralCode(contractData.referral_code);
        setTotalPoints(contractData.total_referral_points || 0);

        // Fetch binary position points for graduation calculation
        const { data: binaryData } = await supabase
          .from('partner_binary_positions')
          .select('left_points, right_points')
          .eq('partner_contract_id', contractData.id)
          .maybeSingle();

        if (binaryData) {
          const weakerLeg = Math.min(binaryData.left_points || 0, binaryData.right_points || 0);
          setBinaryPoints({
            leftPoints: binaryData.left_points || 0,
            rightPoints: binaryData.right_points || 0,
            weakerLegPoints: weakerLeg
          });
        } else {
          setBinaryPoints({
            leftPoints: 0,
            rightPoints: 0,
            weakerLegPoints: 0
          });
        }

        // Fetch referral bonuses
        const { data: bonusesData, error: bonusesError } = await supabase
          .from('partner_referral_bonuses')
          .select('*')
          .eq('referrer_contract_id', contractData.id)
          .order('created_at', { ascending: false });

        if (bonusesError) throw bonusesError;

        // Fetch level points config
        const { data: levelPointsData } = await supabase
          .from('partner_level_points')
          .select('plan_name, points');

        const pointsMap = new Map(
          levelPointsData?.map(lp => [lp.plan_name.toUpperCase(), lp.points]) || []
        );

        // Fetch referred user names and contract plan names
        if (bonusesData && bonusesData.length > 0) {
          const referredUserIds = [...new Set(bonusesData.map(b => b.referred_user_id))];
          const referredContractIds = [...new Set(bonusesData.map(b => b.referred_contract_id))];

          const [profilesResult, contractsResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('user_id, full_name')
              .in('user_id', referredUserIds),
            supabase
              .from('partner_contracts')
              .select('id, plan_name')
              .in('id', referredContractIds)
          ]);

          const profilesMap = new Map(
            profilesResult.data?.map(p => [p.user_id, p.full_name]) || []
          );
          const contractsMap = new Map(
            contractsResult.data?.map(c => [c.id, c.plan_name]) || []
          );

          const bonusesWithDetails = bonusesData.map(bonus => {
            const planName = contractsMap.get(bonus.referred_contract_id) || '';
            const pointsEarned = pointsMap.get(planName.toUpperCase()) || 0;
            
            return {
              ...bonus,
              referred_user_name: profilesMap.get(bonus.referred_user_id) || 'Usuário',
              referred_plan_name: planName,
              points_earned: pointsEarned,
              status: bonus.status as PartnerReferralBonus['status']
            };
          });

          setBonuses(bonusesWithDetails);
        } else {
          setBonuses([]);
        }
      }
    } catch (error) {
      console.error('Error fetching partner referral data:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar indicações",
        description: "Não foi possível carregar suas indicações de parceiros."
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id, toast]);

  useEffect(() => {
    if (profile?.user_id) {
      fetchReferralData();
    }
  }, [profile?.user_id, fetchReferralData]);

  // Estatísticas por nível
  const level1Bonuses = bonuses.filter(b => b.referral_level === 1);
  const level2Bonuses = bonuses.filter(b => b.referral_level === 2);
  const level3Bonuses = bonuses.filter(b => b.referral_level === 3);

  const stats = {
    total: bonuses.length,
    pending: bonuses.filter(b => b.status === 'PENDING').length,
    available: bonuses.filter(b => b.status === 'AVAILABLE').length,
    paid: bonuses.filter(b => b.status === 'PAID').length,
    totalValue: bonuses.reduce((sum, b) => sum + b.bonus_value, 0),
    availableValue: bonuses.filter(b => b.status === 'AVAILABLE').reduce((sum, b) => sum + b.bonus_value, 0),
    // Estatísticas por nível
    byLevel: {
      level1: {
        count: level1Bonuses.length,
        value: level1Bonuses.reduce((sum, b) => sum + b.bonus_value, 0),
      },
      level2: {
        count: level2Bonuses.length,
        value: level2Bonuses.reduce((sum, b) => sum + b.bonus_value, 0),
      },
      level3: {
        count: level3Bonuses.length,
        value: level3Bonuses.reduce((sum, b) => sum + b.bonus_value, 0),
      },
    }
  };

  const getReferralLink = useCallback(() => {
    if (!referralCode) return null;
    return `${window.location.origin}/parceiro?ref=${referralCode}`;
  }, [referralCode]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Em validação';
      case 'AVAILABLE': return 'Disponível';
      case 'PAID': return 'Pago';
      case 'CANCELLED': return 'Cancelado';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'AVAILABLE': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'PAID': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'CANCELLED': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return '';
    }
  };

  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1: return 'Direto';
      case 2: return '2º Nível';
      case 3: return '3º Nível';
      default: return `${level}º Nível`;
    }
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-primary/10 text-primary border-primary/20';
      case 2: return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 3: return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const copyReferralLink = useCallback(async () => {
    const link = getReferralLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "Link copiado!",
        description: "O link de indicação foi copiado para a área de transferência."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link."
      });
    }
  }, [getReferralLink, toast]);

  return {
    bonuses,
    referralCode,
    contractId,
    totalPoints,
    binaryPoints,
    stats,
    loading,
    getReferralLink,
    copyReferralLink,
    getStatusLabel,
    getStatusColor,
    getLevelLabel,
    getLevelColor,
    refreshData: fetchReferralData
  };
};
