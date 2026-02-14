import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FastStartTier {
  id: string;
  name: string;
  required_referrals: number;
  extra_percentage: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const useFastStartTiers = () => {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<FastStartTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchTiers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('fast_start_tiers')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setTiers((data || []) as FastStartTier[]);
    } catch (error) {
      console.error('Error fetching fast start tiers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const updateTier = async (id: string, updates: Partial<FastStartTier>) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('fast_start_tiers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Faixa atualizada com sucesso!' });
      await fetchTiers();
    } catch (error) {
      console.error('Error updating tier:', error);
      toast({ variant: 'destructive', title: 'Erro ao atualizar faixa' });
    } finally {
      setProcessing(false);
    }
  };

  const createTier = async (tier: Omit<FastStartTier, 'id' | 'created_at' | 'updated_at'>) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('fast_start_tiers')
        .insert(tier);

      if (error) throw error;

      toast({ title: 'Faixa criada com sucesso!' });
      await fetchTiers();
    } catch (error) {
      console.error('Error creating tier:', error);
      toast({ variant: 'destructive', title: 'Erro ao criar faixa' });
    } finally {
      setProcessing(false);
    }
  };

  const deleteTier = async (id: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('fast_start_tiers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Faixa removida com sucesso!' });
      await fetchTiers();
    } catch (error) {
      console.error('Error deleting tier:', error);
      toast({ variant: 'destructive', title: 'Erro ao remover faixa' });
    } finally {
      setProcessing(false);
    }
  };

  return {
    tiers,
    loading,
    processing,
    updateTier,
    createTier,
    deleteTier,
    refreshTiers: fetchTiers
  };
};
