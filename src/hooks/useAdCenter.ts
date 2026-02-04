import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface AdCenterMaterial {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdCenterCompletion {
  id: string;
  partner_contract_id: string;
  material_id: string | null;
  completion_date: string;
  social_network: string;
  confirmed_at: string;
}

export interface DayStatus {
  date: string;
  dayName: string;
  dayNumber: number;
  completed: boolean;
  isFuture: boolean;
  isToday: boolean;
}

export interface WeekProgress {
  completedDays: number;
  requiredDays: number;
  unlockPercentage: number;
  bonusPercentage: number;
  weekHistory: DayStatus[];
  canConfirmToday: boolean;
}

const REQUIRED_DAYS = 5;
const BASE_PERCENTAGE = 70;
const BONUS_PERCENTAGE = 30;

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Helper para obter data no formato YYYY-MM-DD (timezone Brasil)
const formatDateBrazil = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper para obter início da semana (segunda-feira)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper para obter fim da semana (domingo)
const getWeekEnd = (date: Date): Date => {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const useAdCenter = (partnerContractId?: string) => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<AdCenterMaterial[]>([]);
  const [completions, setCompletions] = useState<AdCenterCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  // Buscar materiais ativos
  const fetchMaterials = useCallback(async () => {
    const { data, error } = await supabase
      .from('ad_center_materials')
      .select('*')
      .eq('is_active', true)
      .order('target_date', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('[useAdCenter] Erro ao buscar materiais:', error);
      return;
    }

    setMaterials((data as AdCenterMaterial[]) || []);
  }, []);

  // Buscar confirmações do parceiro na semana atual
  const fetchCompletions = useCallback(async () => {
    if (!partnerContractId) return;

    const now = new Date();
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);

    const { data, error } = await supabase
      .from('ad_center_completions')
      .select('*')
      .eq('partner_contract_id', partnerContractId)
      .gte('completion_date', formatDateBrazil(weekStart))
      .lte('completion_date', formatDateBrazil(weekEnd));

    if (error) {
      console.error('[useAdCenter] Erro ao buscar completions:', error);
      return;
    }

    setCompletions((data as AdCenterCompletion[]) || []);
  }, [partnerContractId]);

  // Carregar dados
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchMaterials(), fetchCompletions()]);
      setLoading(false);
    };
    load();
  }, [fetchMaterials, fetchCompletions]);

  // Retorna o material do dia (target_date = hoje ou material genérico mais recente)
  const todayMaterial = useMemo((): AdCenterMaterial | null => {
    const today = formatDateBrazil(new Date());
    
    // Primeiro, tentar material específico para hoje
    const todaySpecific = materials.find(m => m.target_date === today);
    if (todaySpecific) return todaySpecific;
    
    // Senão, retornar o material mais recente sem target_date (genérico)
    const generic = materials.find(m => !m.target_date);
    if (generic) return generic;
    
    // Último recurso: qualquer material ativo
    return materials[0] || null;
  }, [materials]);

  // Calcula o progresso semanal
  const weekProgress = useMemo((): WeekProgress => {
    const now = new Date();
    const today = formatDateBrazil(now);
    const weekStart = getWeekStart(now);
    
    // Gerar dias da semana (Seg a Dom)
    const weekHistory: DayStatus[] = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dateStr = formatDateBrazil(dayDate);
      
      const isCompleted = completions.some(c => c.completion_date === dateStr);
      const isFuture = dateStr > today;
      const isToday = dateStr === today;
      
      weekHistory.push({
        date: dateStr,
        dayName: DAY_NAMES[dayDate.getDay()],
        dayNumber: dayDate.getDate(),
        completed: isCompleted,
        isFuture,
        isToday
      });
    }

    const completedDays = completions.length;
    const effectiveDays = Math.min(completedDays, REQUIRED_DAYS);
    const bonusPercentage = (BONUS_PERCENTAGE * effectiveDays) / REQUIRED_DAYS;
    const unlockPercentage = BASE_PERCENTAGE + bonusPercentage;
    
    // Verificar se já confirmou hoje
    const canConfirmToday = !completions.some(c => c.completion_date === today);

    return {
      completedDays,
      requiredDays: REQUIRED_DAYS,
      unlockPercentage,
      bonusPercentage,
      weekHistory,
      canConfirmToday
    };
  }, [completions]);

  // Confirmar divulgação do dia
  const confirmCompletion = async (socialNetwork: string, materialId?: string): Promise<boolean> => {
    if (!partnerContractId) {
      toast({
        title: 'Erro',
        description: 'Contrato de parceiro não encontrado.',
        variant: 'destructive'
      });
      return false;
    }

    if (!weekProgress.canConfirmToday) {
      toast({
        title: 'Já confirmado',
        description: 'Você já confirmou a divulgação de hoje.',
        variant: 'destructive'
      });
      return false;
    }

    setConfirming(true);
    try {
      const today = formatDateBrazil(new Date());
      
      const { error } = await supabase
        .from('ad_center_completions')
        .insert({
          partner_contract_id: partnerContractId,
          material_id: materialId || null,
          completion_date: today,
          social_network: socialNetwork
        });

      if (error) {
        // Erro de duplicidade (já confirmou)
        if (error.code === '23505') {
          toast({
            title: 'Já confirmado',
            description: 'Você já confirmou a divulgação de hoje.',
            variant: 'destructive'
          });
          return false;
        }
        throw error;
      }

      toast({
        title: 'Divulgação confirmada!',
        description: `Obrigado por divulgar no ${socialNetwork}. Progresso atualizado!`
      });

      // Atualizar completions
      await fetchCompletions();
      return true;
    } catch (error) {
      console.error('[useAdCenter] Erro ao confirmar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível confirmar a divulgação.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setConfirming(false);
    }
  };

  return {
    materials,
    todayMaterial,
    completions,
    weekProgress,
    loading,
    confirming,
    confirmCompletion,
    refreshData: async () => {
      await Promise.all([fetchMaterials(), fetchCompletions()]);
    }
  };
};

// Hook para admin gerenciar materiais
export const useAdCenterAdmin = () => {
  const [materials, setMaterials] = useState<AdCenterMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalMaterials: 0,
    activeMaterials: 0,
    todayConfirmations: 0,
    weekConfirmations: 0
  });

  const fetchMaterials = useCallback(async () => {
    const { data, error } = await supabase
      .from('ad_center_materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[useAdCenterAdmin] Erro:', error);
      return;
    }

    setMaterials((data as AdCenterMaterial[]) || []);
    
    const active = (data || []).filter(m => m.is_active);
    setStats(prev => ({
      ...prev,
      totalMaterials: data?.length || 0,
      activeMaterials: active.length
    }));
  }, []);

  const fetchStats = useCallback(async () => {
    const now = new Date();
    const today = formatDateBrazil(now);
    const weekStart = formatDateBrazil(getWeekStart(now));
    const weekEnd = formatDateBrazil(getWeekEnd(now));

    // Confirmações de hoje
    const { count: todayCount } = await supabase
      .from('ad_center_completions')
      .select('*', { count: 'exact', head: true })
      .eq('completion_date', today);

    // Confirmações da semana
    const { count: weekCount } = await supabase
      .from('ad_center_completions')
      .select('*', { count: 'exact', head: true })
      .gte('completion_date', weekStart)
      .lte('completion_date', weekEnd);

    setStats(prev => ({
      ...prev,
      todayConfirmations: todayCount || 0,
      weekConfirmations: weekCount || 0
    }));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchMaterials(), fetchStats()]);
      setLoading(false);
    };
    load();
  }, [fetchMaterials, fetchStats]);

  // Upload de imagem para o storage
  const uploadMaterialImage = async (file: File): Promise<string | null> => {
    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Fazer upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('ad-center-materials')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('[useAdCenterAdmin] Erro no upload:', error);
        throw error;
      }

      // Retornar URL pública da imagem
      const { data: { publicUrl } } = supabase.storage
        .from('ad-center-materials')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('[useAdCenterAdmin] Erro ao fazer upload:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível fazer upload da imagem.',
        variant: 'destructive'
      });
      return null;
    }
  };

  const createMaterial = async (material: {
    title: string;
    description?: string;
    image_url?: string;
    target_date?: string;
  }): Promise<boolean> => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('ad_center_materials')
        .insert({
          title: material.title,
          description: material.description || null,
          image_url: material.image_url || null,
          target_date: material.target_date || null,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: 'Material criado!',
        description: 'O material promocional foi cadastrado com sucesso.'
      });

      await fetchMaterials();
      return true;
    } catch (error) {
      console.error('[useAdCenterAdmin] Erro ao criar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o material.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const updateMaterial = async (id: string, updates: Partial<AdCenterMaterial>): Promise<boolean> => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('ad_center_materials')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Material atualizado!',
        description: 'As alterações foram salvas.'
      });

      await fetchMaterials();
      return true;
    } catch (error) {
      console.error('[useAdCenterAdmin] Erro ao atualizar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o material.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const deleteMaterial = async (id: string): Promise<boolean> => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('ad_center_materials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Material removido!',
        description: 'O material foi excluído com sucesso.'
      });

      await fetchMaterials();
      return true;
    } catch (error) {
      console.error('[useAdCenterAdmin] Erro ao deletar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o material.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const toggleMaterialActive = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateMaterial(id, { is_active: isActive });
  };

  return {
    materials,
    stats,
    loading,
    processing,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    toggleMaterialActive,
    uploadMaterialImage,
    refreshData: async () => {
      await Promise.all([fetchMaterials(), fetchStats()]);
    }
  };
};
