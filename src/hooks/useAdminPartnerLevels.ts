import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PartnerLevel {
  id: string;
  name: string;
  display_name: string;
  icon: string;
  min_points: number;
  color: string;
  bonus_percentage_increase: number;
  sort_order: number;
  is_active: boolean;
  reward_type: string | null;
  reward_description: string | null;
  reward_value: number | null;
  reward_icon: string;
}

export interface PartnerLevelPoints {
  id: string;
  plan_name: string;
  points: number;
}

export interface NewPartnerLevel {
  name: string;
  display_name: string;
  icon: string;
  min_points: number;
  color: string;
  bonus_percentage_increase: number;
  sort_order: number;
  is_active: boolean;
  reward_type: string | null;
  reward_description: string | null;
  reward_value: number | null;
  reward_icon: string;
}

export const useAdminPartnerLevels = () => {
  const [levels, setLevels] = useState<PartnerLevel[]>([]);
  const [planPoints, setPlanPoints] = useState<PartnerLevelPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchLevels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partner_levels')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLevels(data || []);
    } catch (error) {
      console.error('Error fetching partner levels:', error);
      toast.error('Erro ao carregar graduações');
    }
  }, []);

  const fetchPlanPoints = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partner_level_points')
        .select('*')
        .order('points', { ascending: true });

      if (error) throw error;
      setPlanPoints(data || []);
    } catch (error) {
      console.error('Error fetching plan points:', error);
      toast.error('Erro ao carregar pontos por plano');
    }
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLevels(), fetchPlanPoints()]);
    setLoading(false);
  }, [fetchLevels, fetchPlanPoints]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const createLevel = useCallback(async (level: NewPartnerLevel): Promise<boolean> => {
    setSaving(true);
    try {
      // Validate: must have a level with 0 points
      if (level.min_points === 0 && levels.some(l => l.min_points === 0)) {
        toast.error('Já existe um nível inicial com 0 pontos');
        return false;
      }

      // Validate: min_points must be unique
      if (levels.some(l => l.min_points === level.min_points)) {
        toast.error('Já existe um nível com essa quantidade de pontos');
        return false;
      }

      const { error } = await supabase
        .from('partner_levels')
        .insert(level);

      if (error) throw error;

      toast.success('Graduação criada com sucesso');
      await fetchLevels();
      return true;
    } catch (error: any) {
      console.error('Error creating level:', error);
      toast.error(error.message || 'Erro ao criar graduação');
      return false;
    } finally {
      setSaving(false);
    }
  }, [levels, fetchLevels]);

  const updateLevel = useCallback(async (id: string, updates: Partial<PartnerLevel>): Promise<boolean> => {
    setSaving(true);
    try {
      const currentLevel = levels.find(l => l.id === id);
      if (!currentLevel) {
        toast.error('Graduação não encontrada');
        return false;
      }

      // Validate: cannot change min_points to a value that already exists
      if (updates.min_points !== undefined && updates.min_points !== currentLevel.min_points) {
        if (levels.some(l => l.id !== id && l.min_points === updates.min_points)) {
          toast.error('Já existe um nível com essa quantidade de pontos');
          return false;
        }
      }

      // Validate: cannot disable the only level with 0 points
      if (updates.is_active === false && currentLevel.min_points === 0) {
        const activeLevelsWithZero = levels.filter(l => l.min_points === 0 && l.is_active);
        if (activeLevelsWithZero.length === 1 && activeLevelsWithZero[0].id === id) {
          toast.error('Não é possível desativar o único nível inicial (0 pontos)');
          return false;
        }
      }

      const { error } = await supabase
        .from('partner_levels')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('Graduação atualizada com sucesso');
      await fetchLevels();
      return true;
    } catch (error: any) {
      console.error('Error updating level:', error);
      toast.error(error.message || 'Erro ao atualizar graduação');
      return false;
    } finally {
      setSaving(false);
    }
  }, [levels, fetchLevels]);

  const deleteLevel = useCallback(async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const level = levels.find(l => l.id === id);
      if (!level) {
        toast.error('Graduação não encontrada');
        return false;
      }

      // Validate: cannot delete the level with 0 points
      if (level.min_points === 0) {
        toast.error('Não é possível excluir o nível inicial (0 pontos)');
        return false;
      }

      const { error } = await supabase
        .from('partner_levels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Graduação excluída com sucesso');
      await fetchLevels();
      return true;
    } catch (error: any) {
      console.error('Error deleting level:', error);
      toast.error(error.message || 'Erro ao excluir graduação');
      return false;
    } finally {
      setSaving(false);
    }
  }, [levels, fetchLevels]);

  const toggleLevel = useCallback(async (id: string, isActive: boolean): Promise<boolean> => {
    return updateLevel(id, { is_active: isActive });
  }, [updateLevel]);

  const reorderLevels = useCallback(async (reorderedLevels: PartnerLevel[]): Promise<boolean> => {
    setSaving(true);
    try {
      const updates = reorderedLevels.map((level, index) => ({
        id: level.id,
        sort_order: index
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('partner_levels')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast.success('Ordem atualizada com sucesso');
      await fetchLevels();
      return true;
    } catch (error: any) {
      console.error('Error reordering levels:', error);
      toast.error(error.message || 'Erro ao reordenar graduações');
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchLevels]);

  const updatePlanPoints = useCallback(async (id: string, points: number): Promise<boolean> => {
    setSaving(true);
    try {
      if (points < 0) {
        toast.error('Os pontos não podem ser negativos');
        return false;
      }

      const { error } = await supabase
        .from('partner_level_points')
        .update({ points })
        .eq('id', id);

      if (error) throw error;

      toast.success('Pontos atualizados com sucesso');
      await fetchPlanPoints();
      return true;
    } catch (error: any) {
      console.error('Error updating plan points:', error);
      toast.error(error.message || 'Erro ao atualizar pontos');
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchPlanPoints]);

  // Get statistics
  const levelsWithRewards = levels.filter(l => l.reward_type && l.reward_type !== 'none');
  const totalRewardValue = levelsWithRewards.reduce((sum, l) => sum + (l.reward_value || 0), 0);
  
  const stats = {
    totalLevels: levels.length,
    activeLevels: levels.filter(l => l.is_active).length,
    maxPoints: Math.max(...levels.map(l => l.min_points), 0),
    maxBonus: Math.max(...levels.map(l => l.bonus_percentage_increase), 0),
    totalPlansConfigured: planPoints.length,
    levelsWithRewards: levelsWithRewards.length,
    totalRewardValue
  };

  return {
    levels,
    planPoints,
    loading,
    saving,
    stats,
    createLevel,
    updateLevel,
    deleteLevel,
    toggleLevel,
    reorderLevels,
    updatePlanPoints,
    refreshData
  };
};
