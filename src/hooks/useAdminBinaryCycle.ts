import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface BinaryCyclePreviewPartner {
  partner_contract_id: string;
  partner_name: string;
  plan_name: string;
  left_points: number;
  right_points: number;
  matched_points: number;
  bonus_value: number;
  left_remaining: number;
  right_remaining: number;
}

export interface BinaryCyclePreview {
  bonus_percentage: number;
  point_value: number;
  partners_count: number;
  total_points_matched: number;
  total_bonus_to_distribute: number;
  partners: BinaryCyclePreviewPartner[];
}

export interface BinaryCycleClosure {
  id: string;
  cycle_number: number;
  closed_by: string;
  bonus_percentage: number;
  point_value: number;
  total_points_matched: number;
  total_bonus_distributed: number;
  partners_count: number;
  notes: string | null;
  created_at: string;
  admin_name?: string;
}

export interface BinarySettings {
  binary_bonus_percentage: number;
  binary_point_value: number;
  binary_positioning_timeout_hours: number;
  binary_system_enabled: boolean;
}

export const useAdminBinaryCycle = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cycles, setCycles] = useState<BinaryCycleClosure[]>([]);
  const [preview, setPreview] = useState<BinaryCyclePreview | null>(null);
  const [settings, setSettings] = useState<BinarySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [closingCycle, setClosingCycle] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value, setting_type')
      .in('setting_key', [
        'binary_bonus_percentage',
        'binary_point_value',
        'binary_positioning_timeout_hours',
        'binary_system_enabled'
      ]);

    if (error) {
      console.error('Error fetching binary settings:', error);
      return null;
    }

    const settingsObj: BinarySettings = {
      binary_bonus_percentage: 10,
      binary_point_value: 1,
      binary_positioning_timeout_hours: 24,
      binary_system_enabled: true
    };

    (data || []).forEach(s => {
      if (s.setting_type === 'boolean') {
        (settingsObj as any)[s.setting_key] = s.setting_value === 'true';
      } else if (s.setting_type === 'number') {
        (settingsObj as any)[s.setting_key] = parseFloat(s.setting_value) || 0;
      } else {
        (settingsObj as any)[s.setting_key] = s.setting_value;
      }
    });

    return settingsObj;
  }, []);

  const fetchCycles = useCallback(async () => {
    const { data, error } = await supabase
      .from('binary_cycle_closures')
      .select('*')
      .order('cycle_number', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching binary cycles:', error);
      return [];
    }

    // Fetch admin names
    const closedByIds = [...new Set((data || []).map(c => c.closed_by))];
    
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', closedByIds);

    const profilesMap = new Map(
      (profilesData || []).map(p => [p.user_id, p.full_name])
    );

    return (data || []).map(c => ({
      ...c,
      admin_name: profilesMap.get(c.closed_by) || 'Admin'
    })) as BinaryCycleClosure[];
  }, []);

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const { data, error } = await supabase
        .rpc('preview_binary_cycle_closure');

      if (error) throw error;

      setPreview(data as unknown as BinaryCyclePreview);
    } catch (error) {
      console.error('Error fetching cycle preview:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar o preview do ciclo.'
      });
    } finally {
      setLoadingPreview(false);
    }
  }, [toast]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, cyclesData] = await Promise.all([
        fetchSettings(),
        fetchCycles()
      ]);

      setSettings(settingsData);
      setCycles(cyclesData);
    } catch (error) {
      console.error('Error fetching binary cycle data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchSettings, fetchCycles]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const closeCycle = async (notes?: string) => {
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Você precisa estar logado.'
      });
      return { success: false };
    }

    setClosingCycle(true);
    try {
      const { data, error } = await supabase
        .rpc('close_binary_cycle', {
          p_admin_id: user.id,
          p_notes: notes || null
        });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        cycle_number: number;
        partners_count: number;
        total_bonus_distributed: number;
      };

      if (result.success) {
        toast({
          title: 'Ciclo fechado com sucesso!',
          description: `Ciclo #${result.cycle_number}: ${result.partners_count} parceiros receberam R$ ${result.total_bonus_distributed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em bônus.`
        });

        // Refresh data
        await fetchAllData();
        setPreview(null);
      }

      return result;
    } catch (error) {
      console.error('Error closing binary cycle:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao fechar ciclo',
        description: 'Não foi possível processar o fechamento do ciclo.'
      });
      return { success: false };
    } finally {
      setClosingCycle(false);
    }
  };

  const updateSetting = async (key: keyof BinarySettings, value: string | number | boolean) => {
    try {
      const stringValue = typeof value === 'boolean' ? String(value) : String(value);

      const { error } = await supabase
        .from('system_settings')
        .update({ setting_value: stringValue })
        .eq('setting_key', key);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, [key]: value } : null);

      toast({
        title: 'Configuração atualizada',
        description: 'A configuração foi salva com sucesso.'
      });
    } catch (error) {
      console.error('Error updating binary setting:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a configuração.'
      });
    }
  };

  const getAllBinaryPositions = async () => {
    const { data, error } = await supabase
      .from('partner_binary_positions')
      .select(`
        *,
        partner_contracts!partner_contract_id (
          id,
          plan_name,
          user_id,
          status
        )
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching all binary positions:', error);
      return [];
    }

    // Fetch user names
    const userIds = [...new Set((data || []).map((p: any) => p.partner_contracts?.user_id).filter(Boolean))];
    
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);

    const profilesMap = new Map(
      (profilesData || []).map(p => [p.user_id, p.full_name])
    );

    return (data || []).map((p: any) => ({
      ...p,
      partner_name: profilesMap.get(p.partner_contracts?.user_id) || 'Desconhecido',
      plan_name: p.partner_contracts?.plan_name
    }));
  };

  const getNetworkStats = async () => {
    const { data, error } = await supabase
      .from('partner_binary_positions')
      .select('left_points, right_points, total_left_points, total_right_points');

    if (error) {
      console.error('Error fetching network stats:', error);
      return null;
    }

    const stats = {
      totalPartners: (data || []).length,
      totalLeftPoints: 0,
      totalRightPoints: 0,
      totalPotentialBonus: 0,
      partnersWithPoints: 0
    };

    const bonusPercentage = settings?.binary_bonus_percentage || 10;
    const pointValue = settings?.binary_point_value || 1;

    (data || []).forEach(p => {
      stats.totalLeftPoints += p.left_points;
      stats.totalRightPoints += p.right_points;
      
      const matched = Math.min(p.left_points, p.right_points);
      if (matched > 0) {
        stats.partnersWithPoints++;
        stats.totalPotentialBonus += matched * pointValue * (bonusPercentage / 100);
      }
    });

    return stats;
  };

  return {
    cycles,
    preview,
    settings,
    loading,
    closingCycle,
    loadingPreview,
    refresh: fetchAllData,
    fetchPreview,
    closeCycle,
    updateSetting,
    getAllBinaryPositions,
    getNetworkStats
  };
};
