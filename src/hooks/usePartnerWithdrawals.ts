import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface PartnerWithdrawal {
  id: string;
  partner_contract_id: string;
  amount: number;
  payment_method: string;
  payment_details: {
    pix_key?: string;
    pix_key_type?: string;
    holder_name?: string;
    bank_name?: string;
    agency?: string;
    account?: string;
  };
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  rejection_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PaymentDetails {
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  holder_name?: string;
  bank_name?: string;
  agency?: string;
  account?: string;
}

export const usePartnerWithdrawals = (contractId?: string) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<PartnerWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    if (!contractId) {
      setWithdrawals([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('partner_withdrawals')
        .select('*')
        .eq('partner_contract_id', contractId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals((data || []) as PartnerWithdrawal[]);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  const calculateAvailableBalance = useCallback(async () => {
    if (!contractId) return 0;

    try {
      // Soma dos payouts PAID
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('partner_payouts')
        .select('amount')
        .eq('partner_contract_id', contractId)
        .eq('status', 'PAID');

      if (payoutsError) throw payoutsError;

      const totalPaid = payoutsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // Soma dos saques PAID ou APPROVED (já comprometidos)
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('partner_withdrawals')
        .select('amount, status')
        .eq('partner_contract_id', contractId)
        .in('status', ['PAID', 'APPROVED', 'PENDING']);

      if (withdrawalsError) throw withdrawalsError;

      const totalWithdrawn = withdrawalsData?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;

      return Math.max(0, totalPaid - totalWithdrawn);
    } catch (error) {
      console.error('Error calculating available balance:', error);
      return 0;
    }
  }, [contractId]);

  const requestWithdrawal = async (amount: number, paymentDetails: PaymentDetails) => {
    if (!contractId || !profile?.user_id) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Contrato não encontrado"
      });
      return { success: false };
    }

    // Verificar saldo disponível
    const availableBalance = await calculateAvailableBalance();
    if (amount > availableBalance) {
      toast({
        variant: "destructive",
        title: "Saldo insuficiente",
        description: `Saldo disponível: R$ ${availableBalance.toFixed(2)}`
      });
      return { success: false };
    }

    // Verificar se já existe solicitação aguardando pagamento
    const awaitingPayment = withdrawals.find(w => w.status === 'APPROVED');
    if (awaitingPayment) {
      toast({
        variant: "destructive",
        title: "Saque em andamento",
        description: "Você já possui uma solicitação aguardando pagamento."
      });
      return { success: false };
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('partner_withdrawals')
        .insert([{
          partner_contract_id: contractId,
          amount,
          payment_method: 'pix',
          payment_details: JSON.parse(JSON.stringify(paymentDetails)),
          status: 'APPROVED',
          approved_at: new Date().toISOString()
        }]);

      if (error) throw error;

      toast({
        title: "Saque solicitado!",
        description: "Sua solicitação foi aprovada e aguarda pagamento."
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

  const updateContractPaymentDetails = async (paymentDetails: PaymentDetails) => {
    if (!contractId) return { success: false };

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('partner_contracts')
        .update({
          pix_key: paymentDetails.pix_key,
          pix_key_type: paymentDetails.pix_key_type,
          bank_details: {
            holder_name: paymentDetails.holder_name,
            bank_name: paymentDetails.bank_name,
            agency: paymentDetails.agency,
            account: paymentDetails.account
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', contractId);

      if (error) throw error;

      toast({
        title: "Dados atualizados!",
        description: "Seus dados de pagamento foram salvos."
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error updating payment details:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar dados",
        description: error.message
      });
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  return {
    withdrawals,
    loading,
    submitting,
    requestWithdrawal,
    updateContractPaymentDetails,
    calculateAvailableBalance,
    refreshWithdrawals: fetchWithdrawals,
    hasPendingWithdrawal: withdrawals.some(w => w.status === 'APPROVED')
  };
};
