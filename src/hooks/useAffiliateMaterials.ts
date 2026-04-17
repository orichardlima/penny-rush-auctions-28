import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type MaterialType = 'image' | 'video' | 'copy' | 'banner' | 'story';
export type TargetAudience = 'all' | 'managers' | 'influencers';

export interface AffiliateMaterial {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  copy_text: string | null;
  material_type: MaterialType;
  target_audience: TargetAudience;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateMaterialInput {
  title: string;
  description?: string | null;
  image_url?: string | null;
  copy_text?: string | null;
  material_type: MaterialType;
  target_audience: TargetAudience;
  is_active?: boolean;
  sort_order?: number;
}

export const useAffiliateMaterials = (onlyActive = false) => {
  const [materials, setMaterials] = useState<AffiliateMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      let query = (supabase.from('affiliate_materials' as any).select('*') as any)
        .order('sort_order', { ascending: false })
        .order('created_at', { ascending: false });

      if (onlyActive) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      setMaterials((data || []) as AffiliateMaterial[]);
    } catch (e) {
      console.error('Error fetching affiliate materials:', e);
      toast({ title: 'Erro', description: 'Erro ao carregar materiais.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const createMaterial = async (input: AffiliateMaterialInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from('affiliate_materials' as any).insert({
        ...input,
        created_by: user?.id,
      }) as any);
      if (error) throw error;
      toast({ title: 'Material criado', description: 'Material adicionado com sucesso.' });
      await fetchMaterials();
      return true;
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível criar o material.', variant: 'destructive' });
      return false;
    }
  };

  const updateMaterial = async (id: string, input: Partial<AffiliateMaterialInput>) => {
    try {
      const { error } = await (supabase
        .from('affiliate_materials' as any)
        .update(input)
        .eq('id', id) as any);
      if (error) throw error;
      toast({ title: 'Material atualizado' });
      await fetchMaterials();
      return true;
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
      return false;
    }
  };

  const deleteMaterial = async (id: string) => {
    try {
      const { error } = await (supabase.from('affiliate_materials' as any).delete().eq('id', id) as any);
      if (error) throw error;
      toast({ title: 'Material removido' });
      await fetchMaterials();
      return true;
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível remover.', variant: 'destructive' });
      return false;
    }
  };

  return { materials, loading, refetch: fetchMaterials, createMaterial, updateMaterial, deleteMaterial };
};
