import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductTemplate {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  market_value: number;
  revenue_target: number;
  starting_price: number;
  bid_increment: number;
  bid_cost: number;
  category: string;
  is_active: boolean;
  times_used: number;
  created_at: string;
  updated_at: string;
}

export interface ProductTemplateInput {
  title: string;
  description?: string;
  image_url?: string;
  market_value?: number;
  revenue_target?: number;
  starting_price?: number;
  bid_increment?: number;
  bid_cost?: number;
  category?: string;
  is_active?: boolean;
}

export const useProductTemplates = () => {
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    console.log('[useProductTemplates] Iniciando fetch de templates...');
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('product_templates')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('[useProductTemplates] Resposta:', { data, error: fetchError });

      if (fetchError) {
        console.error('[useProductTemplates] Erro no fetch:', fetchError);
        throw fetchError;
      }
      
      setTemplates(data || []);
      console.log('[useProductTemplates] Templates carregados:', data?.length || 0);
    } catch (err: any) {
      console.error('[useProductTemplates] Erro:', err);
      const errorMessage = err?.message || 'Erro desconhecido ao carregar templates';
      setError(errorMessage);
      toast.error('Erro ao carregar templates: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (template: ProductTemplateInput) => {
    try {
      const { data, error } = await supabase
        .from('product_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;
      setTemplates(prev => [data, ...prev]);
      toast.success('Template criado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast.error('Erro ao criar template');
      return null;
    }
  };

  const updateTemplate = async (id: string, updates: Partial<ProductTemplateInput>) => {
    try {
      const { data, error } = await supabase
        .from('product_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setTemplates(prev => prev.map(t => t.id === id ? data : t));
      toast.success('Template atualizado!');
      return data;
    } catch (error: any) {
      console.error('Error updating template:', error);
      toast.error('Erro ao atualizar template');
      return null;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('product_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template excluído!');
      return true;
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Erro ao excluir template');
      return false;
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate
  };
};

export const TEMPLATE_CATEGORIES = [
  { value: 'eletronicos', label: 'Eletrônicos' },
  { value: 'smartphones', label: 'Smartphones' },
  { value: 'games', label: 'Games' },
  { value: 'informatica', label: 'Informática' },
  { value: 'casa', label: 'Casa & Decoração' },
  { value: 'geral', label: 'Geral' }
];
