import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface PartnerPlan {
  id: string;
  name: string;
  display_name: string;
  aporte_value: number;
  weekly_cap: number;
  total_cap: number;
  is_active: boolean;
  sort_order: number;
  referral_bonus_percentage: number;
  bonus_bids: number;
}

export interface PartnerContract {
  id: string;
  user_id: string;
  plan_name: string;
  aporte_value: number;
  weekly_cap: number;
  total_cap: number;
  total_received: number;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
  bonus_bids_received: number;
  referred_by_user_id: string | null;
  referral_code: string | null;
  // Campos extras para exibição do patrocinador
  sponsor_name?: string | null;
  sponsor_plan_name?: string | null;
}

export interface PartnerPayout {
  id: string;
  partner_contract_id: string;
  period_start: string;
  period_end: string | null;
  calculated_amount: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  weekly_cap_applied: boolean;
  total_cap_applied: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface PartnerUpgrade {
  id: string;
  partner_contract_id: string;
  previous_plan_name: string;
  previous_aporte_value: number;
  previous_weekly_cap: number;
  previous_total_cap: number;
  new_plan_name: string;
  new_aporte_value: number;
  new_weekly_cap: number;
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
      
      if (!data) {
        setContract(null);
        return;
      }
      
      // Se tem patrocinador, buscar nome e plano dele
      let sponsorName: string | null = null;
      let sponsorPlanName: string | null = null;
      
      if (data.referred_by_user_id) {
        // Buscar perfil do patrocinador
        const { data: sponsorProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', data.referred_by_user_id)
          .maybeSingle();
        
        // Buscar contrato do patrocinador para pegar o plano
        const { data: sponsorContract } = await supabase
          .from('partner_contracts')
          .select('plan_name')
          .eq('user_id', data.referred_by_user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        sponsorName = sponsorProfile?.full_name || null;
        sponsorPlanName = sponsorContract?.plan_name || null;
      }
      
      const contractWithSponsor: PartnerContract = {
        id: data.id,
        user_id: data.user_id,
        plan_name: data.plan_name,
        aporte_value: data.aporte_value,
        weekly_cap: data.weekly_cap,
        total_cap: data.total_cap,
        total_received: data.total_received,
        status: data.status as 'ACTIVE' | 'CLOSED' | 'SUSPENDED',
        closed_at: data.closed_at,
        closed_reason: data.closed_reason,
        created_at: data.created_at,
        updated_at: data.updated_at,
        bonus_bids_received: data.bonus_bids_received || 0,
        referred_by_user_id: data.referred_by_user_id,
        referral_code: data.referral_code,
        sponsor_name: sponsorName,
        sponsor_plan_name: sponsorPlanName
      };
      
      setContract(contractWithSponsor);
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
        const normalizedCode = referralCode.trim().toUpperCase();
        console.log('[usePartnerContract] Buscando referrer com código:', normalizedCode);
        
        const { data: referrerContract, error: referrerError } = await supabase
          .from('partner_contracts')
          .select('id, user_id, referral_code')
          .eq('referral_code', normalizedCode)
          .eq('status', 'ACTIVE')
          .maybeSingle();

        if (referrerError) {
          console.warn('[usePartnerContract] Erro ao buscar referrer:', referrerError);
        } else if (referrerContract) {
          if (referrerContract.user_id !== profile.user_id) {
            referredByUserId = referrerContract.user_id;
            referrerContractId = referrerContract.id;
            console.log('[usePartnerContract] Referrer encontrado:', {
              referrerContractId,
              referredByUserId,
              referralCode: referrerContract.referral_code
            });
          } else {
            console.warn('[usePartnerContract] Usuário tentando usar próprio código de referral');
          }
        } else {
          console.warn('[usePartnerContract] Nenhum contrato ativo encontrado com código:', normalizedCode);
        }
      }

      // Gerar código de indicação único
      const newReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      console.log('[usePartnerContract] Inserindo contrato com referred_by_user_id:', referredByUserId);
      
      const { data, error } = await supabase
        .from('partner_contracts')
        .insert({
          user_id: profile.user_id,
          plan_name: plan.name,
          aporte_value: plan.aporte_value,
          weekly_cap: plan.weekly_cap,
          total_cap: plan.total_cap,
          status: 'ACTIVE',
          referred_by_user_id: referredByUserId,
          referral_code: newReferralCode
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[usePartnerContract] Contrato criado:', {
        contractId: data.id,
        referredByUserId: data.referred_by_user_id,
        planName: data.plan_name
      });

      // NOTA: Os bônus de indicação em cascata (até 3 níveis) são criados
      // automaticamente pelo trigger create_cascade_referral_bonuses no banco de dados

      // Creditar bônus de lances se o plano tiver
      if (plan.bonus_bids && plan.bonus_bids > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('bids_balance')
          .eq('user_id', profile.user_id)
          .single();

        const currentBalance = profileData?.bids_balance || 0;
        const newBalance = currentBalance + plan.bonus_bids;

        await supabase
          .from('profiles')
          .update({ bids_balance: newBalance })
          .eq('user_id', profile.user_id);

        // Atualizar o contrato com o bônus recebido
        await supabase
          .from('partner_contracts')
          .update({ bonus_bids_received: plan.bonus_bids })
          .eq('id', data.id);
      }

      setContract(data as PartnerContract);
      toast({
        title: "Contrato criado!",
        description: plan.bonus_bids && plan.bonus_bids > 0 
          ? `Seu contrato foi registrado e você recebeu ${plan.bonus_bids} lances de bônus!`
          : "Seu contrato de parceiro foi registrado com sucesso."
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
          previous_weekly_cap: contract.weekly_cap,
          previous_total_cap: contract.total_cap,
          new_plan_name: newPlan.name,
          new_aporte_value: newPlan.aporte_value,
          new_weekly_cap: newPlan.weekly_cap,
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
          weekly_cap: newPlan.weekly_cap,
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
