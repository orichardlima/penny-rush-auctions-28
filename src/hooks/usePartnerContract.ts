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

export interface PartnerPaymentData {
  contractId: string;
  paymentId: string;
  qrCode?: string;
  qrCodeBase64?: string;
  pixCopyPaste?: string;
  status: string;
  planName: string;
  aporteValue: number;
  bonusBids: number;
}

export interface PartnerUpgradePaymentData {
  paymentId: string;
  qrCode?: string;
  qrCodeBase64?: string;
  pixCopyPaste?: string;
  status: string;
  contractId: string;
  previousPlanName: string;
  newPlanName: string;
  differenceToPay: number;
  newAporteValue: number;
  newTotalCap: number;
  newWeeklyCap: number;
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
  // Campos de pagamento PIX
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_details?: Record<string, unknown> | null;
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
        sponsor_plan_name: sponsorPlanName,
        // Campos de pagamento PIX
        pix_key: data.pix_key || null,
        pix_key_type: data.pix_key_type || null,
        bank_details: (typeof data.bank_details === 'object' && data.bank_details !== null) 
          ? data.bank_details as Record<string, unknown> 
          : null,
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

  const createContract = async (planId: string, referralCode?: string): Promise<{ success: boolean; paymentData?: PartnerPaymentData }> => {
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

    // Verificar se já existe contrato ativo ou pendente
    const { data: existingActive } = await supabase
      .from('partner_contracts')
      .select('id, status')
      .eq('user_id', profile.user_id)
      .in('status', ['ACTIVE', 'PENDING'])
      .maybeSingle();

    if (existingActive) {
      toast({
        variant: "destructive",
        title: existingActive.status === 'ACTIVE' ? "Contrato já existe" : "Pagamento pendente",
        description: existingActive.status === 'ACTIVE' 
          ? "Você já possui um contrato ativo. Aguarde seu encerramento para criar outro."
          : "Você já possui um pagamento pendente. Conclua o pagamento ou aguarde a expiração."
      });
      return { success: false };
    }

    setSubmitting(true);
    try {
      // Buscar email do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      const userName = profile.full_name || 'Usuário';

      console.log('[usePartnerContract] Iniciando pagamento PIX para plano:', {
        planId,
        planName: plan.name,
        referralCode: referralCode || 'NENHUM'
      });

      // Chamar Edge Function para gerar pagamento PIX
      const { data, error } = await supabase.functions.invoke('partner-payment', {
        body: {
          planId,
          userId: profile.user_id,
          userEmail,
          userName,
          referralCode: referralCode || undefined
        }
      });

      if (error) {
        console.error('[usePartnerContract] Erro na edge function:', error);
        throw new Error(error.message || 'Erro ao gerar pagamento');
      }

      if (data.error) {
        console.error('[usePartnerContract] Erro retornado pela edge function:', data.error);
        throw new Error(data.error);
      }

      console.log('[usePartnerContract] Pagamento PIX gerado com sucesso:', {
        contractId: data.contractId,
        paymentId: data.paymentId
      });

      const paymentData: PartnerPaymentData = {
        contractId: data.contractId,
        paymentId: data.paymentId,
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        pixCopyPaste: data.pixCopyPaste,
        status: data.status,
        planName: data.planName,
        aporteValue: data.aporteValue,
        bonusBids: data.bonusBids
      };

      return { success: true, paymentData };
    } catch (error: any) {
      console.error('Error creating contract payment:', error);
      toast({
        variant: "destructive",
        title: "Erro ao criar pagamento",
        description: error.message || "Não foi possível gerar o pagamento PIX."
      });
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  const upgradeContract = async (newPlanId: string): Promise<{ success: boolean; paymentData?: PartnerUpgradePaymentData }> => {
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

    setSubmitting(true);
    try {
      // Buscar email do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      const userName = profile.full_name || 'Usuário';

      console.log('[usePartnerContract] Iniciando pagamento PIX para upgrade:', {
        contractId: contract.id,
        currentPlan: contract.plan_name,
        newPlanId,
        newPlanName: newPlan.name
      });

      // Chamar Edge Function para gerar pagamento PIX do upgrade
      const { data, error } = await supabase.functions.invoke('partner-upgrade-payment', {
        body: {
          contractId: contract.id,
          newPlanId,
          userId: profile.user_id,
          userEmail,
          userName
        }
      });

      if (error) {
        console.error('[usePartnerContract] Erro na edge function:', error);
        throw new Error(error.message || 'Erro ao gerar pagamento');
      }

      if (data.error) {
        console.error('[usePartnerContract] Erro retornado pela edge function:', data.error);
        throw new Error(data.error);
      }

      console.log('[usePartnerContract] Pagamento PIX de upgrade gerado com sucesso:', {
        paymentId: data.paymentId,
        differenceToPay: data.differenceToPay
      });

      const paymentData: PartnerUpgradePaymentData = {
        paymentId: data.paymentId,
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        pixCopyPaste: data.pixCopyPaste,
        status: data.status,
        contractId: data.contractId,
        previousPlanName: data.previousPlanName,
        newPlanName: data.newPlanName,
        differenceToPay: data.differenceToPay,
        newAporteValue: data.newAporteValue,
        newTotalCap: data.newTotalCap,
        newWeeklyCap: data.newWeeklyCap
      };

      return { success: true, paymentData };
    } catch (error: any) {
      console.error('Error creating upgrade payment:', error);
      toast({
        variant: "destructive",
        title: "Erro ao criar pagamento",
        description: error.message || "Não foi possível gerar o pagamento PIX para o upgrade."
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
