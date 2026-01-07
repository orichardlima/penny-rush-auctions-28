import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ReferralBonus {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  purchase_id: string | null;
  package_value: number;
  bonus_percentage: number;
  bonus_value: number;
  status: 'PENDING' | 'BLOCKED' | 'AVAILABLE' | 'USED';
  blocked_reason: string | null;
  available_at: string | null;
  used_at: string | null;
  created_at: string;
  referred_user_name?: string;
}

export const useReferralBonuses = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [bonuses, setBonuses] = useState<ReferralBonus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBonuses = useCallback(async () => {
    if (!profile?.user_id) return;

    try {
      const { data, error } = await supabase
        .from('referral_bonuses')
        .select('*')
        .eq('referrer_user_id', profile.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch referred user names
      const referredUserIds = [...new Set(data?.map(b => b.referred_user_id) || [])];
      if (referredUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', referredUserIds);

        const profilesMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        const bonusesWithNames = (data || []).map(bonus => ({
          ...bonus,
          referred_user_name: profilesMap.get(bonus.referred_user_id) || 'Usuário'
        }));

        setBonuses(bonusesWithNames);
      } else {
        setBonuses(data || []);
      }
    } catch (error) {
      console.error('Error fetching referral bonuses:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar bônus",
        description: "Não foi possível carregar seus bônus de indicação."
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id, toast]);

  useEffect(() => {
    if (profile?.user_id) {
      fetchBonuses();
    }
  }, [profile?.user_id, fetchBonuses]);

  const stats = {
    total: bonuses.length,
    pending: bonuses.filter(b => b.status === 'PENDING').length,
    available: bonuses.filter(b => b.status === 'AVAILABLE').length,
    used: bonuses.filter(b => b.status === 'USED').length,
    blocked: bonuses.filter(b => b.status === 'BLOCKED').length,
    totalValue: bonuses.reduce((sum, b) => sum + b.bonus_value, 0),
    availableValue: bonuses.filter(b => b.status === 'AVAILABLE').reduce((sum, b) => sum + b.bonus_value, 0),
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Em validação';
      case 'BLOCKED': return 'Bloqueado';
      case 'AVAILABLE': return 'Disponível';
      case 'USED': return 'Utilizado';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'BLOCKED': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'AVAILABLE': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'USED': return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default: return '';
    }
  };

  return {
    bonuses,
    stats,
    loading,
    getStatusLabel,
    getStatusColor,
    refreshBonuses: fetchBonuses
  };
};
