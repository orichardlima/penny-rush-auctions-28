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
  referral_bonus_percentage: number;
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
  period_start: string;
  period_end: string | null;
  calculated_amount: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  monthly_cap_applied: boolean;
  total_cap_applied: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface PartnerUpgrade {
  id: string;
  partner_contract_id: string;
  previous_plan_name: string;
  previous_aporte_value: number;
  previous_monthly_cap: number;
  previous_total_cap: number;
  new_plan_name: string;
  new_aporte_value: number;
  new_monthly_cap: number;
  new_total_cap: number;
  total_received_at_upgrade: number;
  difference_paid: number;
  created_at: string;
  notes: string | null;
}

export const usePartnerContract = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [contract, setContract] = useState<PartnerContract | null>(null);
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);
  const [upgrades, setUpgrades] = useState<PartnerUpgrade[]>([]);
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
        .order('period_start', { ascending: false });

      if (error) throw error;
      setPayouts((data || []) as PartnerPayout[]);
    } catch (error) {
      console.error('Error fetching partner payouts:', error);
    }
  }, [contract?.id]);

  const fetchUpgrades = useCallback(async () => {
    if (!contract?.id) return;

    try {
      const { data, error } = await supabase
        .from('partner_upgrades')
        .select('*')
        .eq('partner_contract_id', contract.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUpgrades((data || []) as PartnerUpgrade[]);
    } catch (error) {
      console.error('Error fetching partner upgrades:', error);
    }
  }, [contract?.id]);

  const createContract = async (planId: string, referralCode?: string) => {
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

    // Verificar se já existe contrato ativo
    const { data: existingActive } = await supabase
      .from('partner_contracts')
      .select('id')
      .eq('user_id', profile.user_id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (existingActive) {
      toast({
        variant: "destructive",
        title: "Contrato já existe",
        description: "Você já possui um contrato ativo. Aguarde seu encerramento para criar outro."
      });
      return { success: false };
    }

    setSubmitting(true);
    try {
      // Buscar contrato referenciador se houver código
      let referredByUserId: string | null = null;
      let referrerContractId: string | null = null;
      
      if (referralCode) {
        const { data: referrerContract } = await supabase
          .from('partner_contracts')
          .select('id, user_id')
          .eq('referral_code', referralCode.toUpperCase())
          .eq('status', 'ACTIVE')
          .maybeSingle();

        if (referrerContract && referrerContract.user_id !== profile.user_id) {
          referredByUserId = referrerContract.user_id;
          referrerContractId = referrerContract.id;
        }
      }

      // Gerar código de indicação único
      const newReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data, error } = await supabase
        .from('partner_contracts')
        .insert({
          user_id: profile.user_id,
          plan_name: plan.name,
          aporte_value: plan.aporte_value,
          monthly_cap: plan.monthly_cap,
          total_cap: plan.total_cap,
          status: 'ACTIVE',
          referred_by_user_id: referredByUserId,
          referral_code: newReferralCode
        })
        .select()
        .single();

      if (error) throw error;

      // Criar bônus de indicação se foi indicado - usar % do plano do referrer
      if (referrerContractId && data) {
        // Buscar o plano do referrer para pegar a porcentagem correta
        const { data: referrerContractData } = await supabase
          .from('partner_contracts')
          .select('plan_name')
          .eq('id', referrerContractId)
          .single();
        
        const referrerPlan = plans.find(p => p.name === referrerContractData?.plan_name);
        const bonusPercentage = referrerPlan?.referral_bonus_percentage || 10;
        const bonusValue = plan.aporte_value * (bonusPercentage / 100);
        const availableAt = new Date();
        availableAt.setDate(availableAt.getDate() + 7); // 7 dias para validação

        await supabase.from('partner_referral_bonuses').insert({
          referrer_contract_id: referrerContractId,
          referred_contract_id: data.id,
          referred_user_id: profile.user_id,
          aporte_value: plan.aporte_value,
          bonus_percentage: bonusPercentage,
          bonus_value: bonusValue,
          status: 'PENDING',
          available_at: availableAt.toISOString()
        });
      }

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

  const upgradeContract = async (newPlanId: string) => {
    if (!contract || !profile?.user_id) return { success: false };

    const newPlan = plans.find(p => p.id === newPlanId);
    if (!newPlan) {
      toast({
        variant: "destructive",
        title: "Plano não encontrado",
        description: "O plano selecionado não está disponível."
      });
      return { success: false };
    }

    // Validação 1: Apenas planos superiores
    if (newPlan.aporte_value <= contract.aporte_value) {
      toast({
        variant: "destructive",
        title: "Upgrade inválido",
        description: "Só é possível fazer upgrade para um plano superior."
      });
      return { success: false };
    }

    // Validação 2: Limite de 80% do teto
    const progressPercentage = (contract.total_received / contract.total_cap) * 100;
    if (progressPercentage >= 80) {
      toast({
        variant: "destructive",
        title: "Upgrade não disponível",
        description: "Você já atingiu mais de 80% do teto atual. Aguarde o encerramento do contrato."
      });
      return { success: false };
    }

    // Validação 3: Contrato deve estar ativo
    if (contract.status !== 'ACTIVE') {
      toast({
        variant: "destructive",
        title: "Contrato inativo",
        description: "Só é possível fazer upgrade em contratos ativos."
      });
      return { success: false };
    }

    const differenceToPay = newPlan.aporte_value - contract.aporte_value;

    setSubmitting(true);
    try {
      // 1. Registrar o upgrade na tabela de auditoria
      const { error: upgradeError } = await supabase
        .from('partner_upgrades')
        .insert({
          partner_contract_id: contract.id,
          previous_plan_name: contract.plan_name,
          previous_aporte_value: contract.aporte_value,
          previous_monthly_cap: contract.monthly_cap,
          previous_total_cap: contract.total_cap,
          new_plan_name: newPlan.name,
          new_aporte_value: newPlan.aporte_value,
          new_monthly_cap: newPlan.monthly_cap,
          new_total_cap: newPlan.total_cap,
          total_received_at_upgrade: contract.total_received,
          difference_paid: differenceToPay
        });

      if (upgradeError) throw upgradeError;

      // 2. Atualizar o contrato existente (NÃO criar novo)
      // total_received NÃO é alterado - preservando histórico
      const { data: updatedContract, error: updateError } = await supabase
        .from('partner_contracts')
        .update({
          plan_name: newPlan.name,
          aporte_value: newPlan.aporte_value,
          monthly_cap: newPlan.monthly_cap,
          total_cap: newPlan.total_cap,
          updated_at: new Date().toISOString()
        })
        .eq('id', contract.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setContract(updatedContract as PartnerContract);
      
      toast({
        title: "Upgrade realizado!",
        description: `Seu plano foi atualizado para ${newPlan.display_name}. Diferença: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(differenceToPay)}`
      });

      await fetchUpgrades();

      return { success: true, differenceToPay };
    } catch (error: any) {
      console.error('Error upgrading contract:', error);
      toast({
        variant: "destructive",
        title: "Erro no upgrade",
        description: error.message || "Não foi possível realizar o upgrade."
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

  const getAvailableUpgrades = useCallback(() => {
    if (!contract) return [];
    return plans.filter(p => p.aporte_value > contract.aporte_value);
  }, [contract, plans]);

  const canUpgrade = useCallback(() => {
    if (!contract) return false;
    if (contract.status !== 'ACTIVE') return false;
    const progressPercentage = (contract.total_received / contract.total_cap) * 100;
    return progressPercentage < 80 && getAvailableUpgrades().length > 0;
  }, [contract, getAvailableUpgrades]);

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
      fetchUpgrades();
    }
  }, [contract?.id, fetchPayouts, fetchUpgrades]);

  return {
    contract,
    payouts,
    upgrades,
    plans,
    loading,
    submitting,
    createContract,
    upgradeContract,
    getProgress,
    getLastPayout,
    getAvailableUpgrades,
    canUpgrade,
    refreshData: async () => {
      await fetchContract();
      await fetchPayouts();
      await fetchUpgrades();
    }
  };
};
