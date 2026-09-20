import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PartnerRevenueOverride {
  id: string;
  user_id: string;
  weekly_percentage: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerRevenueOverrideAuditRow {
  id: string;
  user_id: string;
  action: string;
  old_percentage: number | null;
  new_percentage: number | null;
  old_is_active: boolean | null;
  new_is_active: boolean | null;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export const usePartnerRevenueOverride = (userId?: string | null) => {
  const { toast } = useToast();
  const [override, setOverride] = useState<PartnerRevenueOverride | null>(null);
  const [audit, setAudit] = useState<PartnerRevenueOverrideAuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchOverride = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [{ data: row }, { data: auditRows }] = await Promise.all([
        supabase
          .from('partner_revenue_overrides')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('partner_revenue_override_audit')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      setOverride((row as PartnerRevenueOverride) ?? null);
      setAudit((auditRows as PartnerRevenueOverrideAuditRow[]) ?? []);
    } catch (error) {
      console.error('Error loading partner revenue override:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchOverride();
  }, [fetchOverride]);

  const saveOverride = async (weeklyPercentage: number, note: string, isActive: boolean) => {
    if (!userId) return false;
    if (weeklyPercentage < 0 || weeklyPercentage > 100) {
      toast({ variant: 'destructive', title: 'Percentual inválido', description: 'Informe um valor entre 0 e 100.' });
      return false;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('partner_revenue_overrides')
        .upsert(
          {
            user_id: userId,
            weekly_percentage: weeklyPercentage,
            note: note || null,
            is_active: isActive,
          },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
      toast({ title: 'Percentual específico salvo', description: 'A regra deste parceiro foi atualizada.' });
      await fetchOverride();
      return true;
    } catch (error: any) {
      console.error('Error saving partner revenue override:', error);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error?.message || 'Tente novamente.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async () => {
    if (!userId) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('partner_revenue_overrides')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
      toast({ title: 'Exceção removida', description: 'O parceiro voltou à regra geral de faturamento.' });
      await fetchOverride();
      return true;
    } catch (error: any) {
      console.error('Error removing partner revenue override:', error);
      toast({ variant: 'destructive', title: 'Erro ao remover', description: error?.message || 'Tente novamente.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { override, audit, loading, saving, fetchOverride, saveOverride, removeOverride };
};
