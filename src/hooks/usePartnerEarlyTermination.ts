import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { PartnerContract } from './usePartnerContract';

export interface EarlyTerminationRequest {
  id: string;
  partner_contract_id: string;
  requested_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  liquidation_type: 'PARTIAL_REFUND' | 'CREDITS' | 'BIDS';
  aporte_original: number;
  total_received: number;
  remaining_cap: number;
  discount_percentage: number;
  proposed_value: number;
  final_value: number | null;
  credits_amount: number | null;
  bids_amount: number | null;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiquidationProposal {
  remainingCap: number;
  discountPercentage: number;
  proposedValue: number;
  creditsEquivalent: number;
  bidsEquivalent: number;
}

export const usePartnerEarlyTermination = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [pendingRequest, setPendingRequest] = useState<EarlyTerminationRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const DEFAULT_DISCOUNT_PERCENTAGE = 30;
  const BID_VALUE = 0.50; // Valor de cada lance

  const fetchPendingRequest = useCallback(async (contractId: string) => {
    if (!contractId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partner_early_terminations')
        .select('*')
        .eq('partner_contract_id', contractId)
        .in('status', ['PENDING', 'APPROVED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPendingRequest({
          ...data,
          status: data.status as EarlyTerminationRequest['status'],
          liquidation_type: data.liquidation_type as EarlyTerminationRequest['liquidation_type']
        });
      } else {
        setPendingRequest(null);
      }
    } catch (error) {
      console.error('Error fetching termination request:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateLiquidationProposal = useCallback((contract: PartnerContract): LiquidationProposal => {
    const remainingCap = contract.total_cap - contract.total_received;
    const discountPercentage = DEFAULT_DISCOUNT_PERCENTAGE;
    const proposedValue = remainingCap * (1 - discountPercentage / 100);
    
    return {
      remainingCap,
      discountPercentage,
      proposedValue,
      creditsEquivalent: proposedValue,
      bidsEquivalent: Math.floor(proposedValue / BID_VALUE)
    };
  }, []);

  const requestTermination = async (
    contract: PartnerContract,
    liquidationType: 'PARTIAL_REFUND' | 'CREDITS' | 'BIDS'
  ) => {
    if (!profile?.user_id) return { success: false };

    // Validar se contrato já está fechado
    if (contract.status === 'CLOSED') {
      toast({
        variant: "destructive",
        title: "Contrato já encerrado",
        description: "Este contrato já foi encerrado anteriormente."
      });
      return { success: false };
    }

    setSubmitting(true);
    try {
      // Verificar se já existe solicitação pendente ou completada
      const { data: existingRequest } = await supabase
        .from('partner_early_terminations')
        .select('id, status')
        .eq('partner_contract_id', contract.id)
        .in('status', ['PENDING', 'APPROVED', 'COMPLETED'])
        .limit(1)
        .maybeSingle();

      if (existingRequest) {
        toast({
          variant: "destructive",
          title: "Solicitação já existe",
          description: existingRequest.status === 'COMPLETED' 
            ? "Este contrato já foi encerrado." 
            : "Já existe uma solicitação pendente para este contrato."
        });
        setSubmitting(false);
        return { success: false };
      }

      const proposal = calculateLiquidationProposal(contract);

      const terminationData = {
        partner_contract_id: contract.id,
        liquidation_type: liquidationType,
        aporte_original: contract.aporte_value,
        total_received: contract.total_received,
        remaining_cap: proposal.remainingCap,
        discount_percentage: proposal.discountPercentage,
        proposed_value: proposal.proposedValue,
        credits_amount: liquidationType === 'CREDITS' ? proposal.creditsEquivalent : null,
        bids_amount: liquidationType === 'BIDS' ? proposal.bidsEquivalent : null,
        status: 'PENDING'
      };

      const { data, error } = await supabase
        .from('partner_early_terminations')
        .insert(terminationData)
        .select()
        .single();

      if (error) throw error;

      setPendingRequest({
        ...data,
        status: data.status as EarlyTerminationRequest['status'],
        liquidation_type: data.liquidation_type as EarlyTerminationRequest['liquidation_type']
      });

      toast({
        title: "Solicitação enviada",
        description: "Sua solicitação de encerramento antecipado foi registrada e será analisada."
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error requesting termination:', error);
      toast({
        variant: "destructive",
        title: "Erro ao solicitar encerramento",
        description: error.message || "Não foi possível processar sua solicitação."
      });
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (requestId: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('partner_early_terminations')
        .delete()
        .eq('id', requestId)
        .eq('status', 'PENDING');

      if (error) throw error;

      setPendingRequest(null);
      toast({
        title: "Solicitação cancelada",
        description: "Sua solicitação de encerramento foi cancelada."
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error canceling termination request:', error);
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: error.message
      });
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Aguardando análise';
      case 'APPROVED': return 'Aprovado';
      case 'REJECTED': return 'Recusado';
      case 'COMPLETED': return 'Concluído';
      default: return status;
    }
  };

  const getLiquidationTypeLabel = (type: string) => {
    switch (type) {
      case 'PARTIAL_REFUND': return 'Reembolso parcial';
      case 'CREDITS': return 'Créditos na plataforma';
      case 'BIDS': return 'Conversão em lances';
      default: return type;
    }
  };

  return {
    pendingRequest,
    loading,
    submitting,
    fetchPendingRequest,
    calculateLiquidationProposal,
    requestTermination,
    cancelRequest,
    getStatusLabel,
    getLiquidationTypeLabel
  };
};
