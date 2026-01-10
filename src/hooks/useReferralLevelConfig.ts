import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ReferralLevelConfig {
  id: string;
  level: number;
  percentage: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useReferralLevelConfig = () => {
  const { toast } = useToast();
  const [levels, setLevels] = useState<ReferralLevelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchLevels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('referral_level_config')
        .select('*')
        .order('level', { ascending: true });

      if (error) throw error;
      setLevels(data || []);
    } catch (error) {
      console.error('Error fetching referral level config:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar configuração",
        description: "Não foi possível carregar os níveis de indicação."
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  const updateLevel = async (levelId: string, updates: Partial<Pick<ReferralLevelConfig, 'percentage' | 'is_active' | 'description'>>) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('referral_level_config')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', levelId);

      if (error) throw error;

      toast({
        title: "Configuração atualizada",
        description: "A configuração do nível foi salva com sucesso."
      });

      await fetchLevels();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating referral level config:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar a configuração."
      });
      return { success: false };
    } finally {
      setUpdating(false);
    }
  };

  const toggleLevel = async (levelId: string, isActive: boolean) => {
    return updateLevel(levelId, { is_active: isActive });
  };

  const updatePercentage = async (levelId: string, percentage: number) => {
    if (percentage < 0 || percentage > 100) {
      toast({
        variant: "destructive",
        title: "Porcentagem inválida",
        description: "A porcentagem deve estar entre 0 e 100."
      });
      return { success: false };
    }
    return updateLevel(levelId, { percentage });
  };

  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1: return 'Indicação Direta (1º Nível)';
      case 2: return 'Segundo Nível';
      case 3: return 'Terceiro Nível';
      default: return `${level}º Nível`;
    }
  };

  const getLevelDescription = (level: number) => {
    switch (level) {
      case 1: return 'Usa a porcentagem configurada no plano do parceiro indicador';
      case 2: return 'Bônus para o "avô" do indicado (quem indicou o indicador direto)';
      case 3: return 'Bônus para o "bisavô" do indicado (terceiro nível acima)';
      default: return '';
    }
  };

  return {
    levels,
    loading,
    updating,
    updateLevel,
    toggleLevel,
    updatePercentage,
    getLevelLabel,
    getLevelDescription,
    refreshLevels: fetchLevels
  };
};
