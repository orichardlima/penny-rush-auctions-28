import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface PartnerPlan {
  id: string;
  name: string;
  display_name: string;
  aporte_value: number;
  monthly_cap: number;
  total_cap: number;
  is_active: boolean;
  sort_order: number;
}

export interface PartnerContract {
  id: string;
  user_id: string;
  plan_name: string;
  aporte_value: number;
  monthly_cap: number;
  total_cap: number;
  total_received: number;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerPayout {
  id: string;
  partner_contract_id: string;
  month: string;
  calculated_amount: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  monthly_cap_applied: boolean;
  total_cap_applied: boolean;
  paid_at: string | null;
  created_at: string;
}

export const usePartnerContract = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [contract, setContract] = useState<PartnerContract | null>(null);
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);
  const [plans, setPlans] = useState<PartnerPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partner_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching partner plans:', error);
    }
  }, []);

  const fetchContract = useCallback(async () => {
    if (!profile?.user_id) return;

    try {
      const { data, error } = await supabase
        .from('partner_contracts')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setContract(data as PartnerContract | null);
    } catch (error) {
      console.error('Error fetching partner contract:', error);
    }
  }, [profile?.user_id]);

  const fetchPayouts = useCallback(async () => {
    if (!contract?.id) return;

    try {
      const { data, error } = await supabase
        .from('partner_payouts')
        .select('*')
        .eq('partner_contract_id', contract.id)
        .order('month', { ascending: false });

      if (error) throw error;
      setPayouts((data || []) as PartnerPayout[]);
    } catch (error) {
      console.error('Error fetching partner payouts:', error);
    }
  }, [contract?.id]);

  const createContract = async (planId: string) => {
    if (!profile?.user_id) return { success: false };

    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Plano não encontrado"
      });
      return { success: false };
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('partner_contracts')
        .insert({
          user_id: profile.user_id,
          plan_name: plan.name,
          aporte_value: plan.aporte_value,
          monthly_cap: plan.monthly_cap,
          total_cap: plan.total_cap,
          status: 'ACTIVE'
        })
        .select()
        .single();

      if (error) throw error;

      setContract(data as PartnerContract);
      toast({
        title: "Contrato criado!",
        description: "Seu contrato de parceiro foi registrado com sucesso."
      });
      return { success: true };
    } catch (error: any) {
      console.error('Error creating contract:', error);
      toast({
        variant: "destructive",
        title: "Erro ao criar contrato",
        description: error.message || "Não foi possível criar o contrato."
      });
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  const getProgress = useCallback(() => {
    if (!contract) return { percentage: 0, remaining: 0 };
    
    const percentage = Math.min((contract.total_received / contract.total_cap) * 100, 100);
    const remaining = Math.max(contract.total_cap - contract.total_received, 0);
    
    return { percentage, remaining };
  }, [contract]);

  const getLastPayout = useCallback(() => {
    if (payouts.length === 0) return null;
    return payouts[0];
  }, [payouts]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPlans();
      await fetchContract();
      setLoading(false);
    };
    loadData();
  }, [fetchPlans, fetchContract]);

  useEffect(() => {
    if (contract?.id) {
      fetchPayouts();
    }
  }, [contract?.id, fetchPayouts]);

  return {
    contract,
    payouts,
    plans,
    loading,
    submitting,
    createContract,
    getProgress,
    getLastPayout,
    refreshData: async () => {
      await fetchContract();
      await fetchPayouts();
    }
  };
};
