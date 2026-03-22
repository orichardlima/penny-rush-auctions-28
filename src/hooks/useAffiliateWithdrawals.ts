import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AffiliateWithdrawal {
  id: string;
  affiliate_id: string;
  amount: number;
  payment_method: string;
  payment_details: {
    pix_key?: string;
    pix_key_type?: string;
    holder_name?: string;
  };
  status: string;
  rejection_reason: string | null;
  processed_at: string | null;
  processed_by: string | null;
  created_at: string;
}

export interface AffiliatePixDetails {
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  holder_name?: string;
}

export const useAffiliateWithdrawals = (affiliateId?: string) => {
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<AffiliateWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [minWithdrawal, setMinWithdrawal] = useState(50);

  const fetchWithdrawals = useCallback(async () => {
    if (!affiliateId) {
      setWithdrawals([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('affiliate_withdrawals')
        .select('*')
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals((data || []) as AffiliateWithdrawal[]);
    } catch (error) {
      console.error('Error fetching affiliate withdrawals:', error);
    } finally {
      setLoading(false);
    }
  }, [affiliateId]);

  const fetchMinWithdrawal = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'affiliate_min_withdrawal')
        .single();

      if (data?.setting_value) {
        setMinWithdrawal(parseFloat(data.setting_value) || 50);
      }
    } catch {
      // Use default
    }
  }, []);

  const requestWithdrawal = async (amount: number, pixDetails: AffiliatePixDetails) => {
    if (!affiliateId) {
      toast({ variant: "destructive", title: "Erro", description: "Afiliado não encontrado" });
      return { success: false };
    }

    if (amount < minWithdrawal) {
      toast({
        variant: "destructive",
        title: "Valor mínimo",
        description: `O valor mínimo para saque é R$ ${minWithdrawal.toFixed(2)}`
      });
      return { success: false };
    }

    const hasPending = withdrawals.some(w => w.status === 'pending');
    if (hasPending) {
      toast({
        variant: "destructive",
        title: "Saque pendente",
        description: "Você já possui uma solicitação de saque pendente."
      });
      return { success: false };
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('affiliate_withdrawals')
        .insert([{
          affiliate_id: affiliateId,
          amount,
          payment_method: 'pix',
          payment_details: JSON.parse(JSON.stringify({
            pix_key: pixDetails.pix_key,
            pix_key_type: pixDetails.pix_key_type,
            holder_name: pixDetails.holder_name
          }))
        }]);

      if (error) throw error;

      toast({
        title: "Saque solicitado!",
        description: "Sua solicitação foi enviada e aguarda aprovação."
      });

      await fetchWithdrawals();
      return { success: true };
    } catch (error: any) {
      console.error('Error requesting withdrawal:', error);
      toast({
        variant: "destructive",
        title: "Erro ao solicitar saque",
        description: error.message
      });
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  const savePixDetails = async (pixDetails: AffiliatePixDetails) => {
    if (!affiliateId) return { success: false };

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({
          pix_key: pixDetails.pix_key,
          bank_details: JSON.parse(JSON.stringify({
            pix_key_type: pixDetails.pix_key_type,
            holder_name: pixDetails.holder_name
          }))
        })
        .eq('id', affiliateId);

      if (error) throw error;

      toast({ title: "Dados PIX salvos!", description: "Seus dados de pagamento foram atualizados." });
      return { success: true };
    } catch (error: any) {
      console.error('Error saving pix details:', error);
      toast({ variant: "destructive", title: "Erro", description: error.message });
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
    fetchMinWithdrawal();
  }, [fetchWithdrawals, fetchMinWithdrawal]);

  return {
    withdrawals,
    loading,
    submitting,
    minWithdrawal,
    requestWithdrawal,
    savePixDetails,
    refreshWithdrawals: fetchWithdrawals,
    hasPendingWithdrawal: withdrawals.some(w => w.status === 'pending')
  };
};
