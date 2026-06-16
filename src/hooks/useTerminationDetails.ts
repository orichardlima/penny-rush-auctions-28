import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TerminationRecord {
  id: string;
  partner_contract_id: string;
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
  requested_at: string;
  processed_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payout_reference: string | null;
  created_at: string;
}

export interface TerminationContract {
  id: string;
  plan_name: string;
  aporte_value: number;
  total_cap: number;
  weekly_cap: number;
  total_received: number;
  cotas: number;
  status: string;
  created_at: string;
  closed_at: string | null;
  closed_reason: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
}

export interface TerminationPayoutItem {
  id: string;
  period_start: string;
  period_end: string | null;
  amount: number;
  calculated_amount: number;
  status: string;
  paid_at: string | null;
}

export interface TerminationReferralBonus {
  id: string;
  bonus_amount: number;
  level: number;
  status: string;
  created_at: string;
  source_user_name?: string | null;
}

export interface TerminationDetails {
  termination: TerminationRecord | null;
  contract: TerminationContract | null;
  payouts: TerminationPayoutItem[];
  referralBonuses: TerminationReferralBonus[];
  slaDays: number;
  totalWithdrawnPix: number;
  totalCreditedNotWithdrawn: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useTerminationDetails = (): TerminationDetails => {
  const { profile } = useAuth();
  const [termination, setTermination] = useState<TerminationRecord | null>(null);
  const [contract, setContract] = useState<TerminationContract | null>(null);
  const [payouts, setPayouts] = useState<TerminationPayoutItem[]>([]);
  const [referralBonuses, setReferralBonuses] = useState<TerminationReferralBonus[]>([]);
  const [slaDays, setSlaDays] = useState<number>(7);
  const [totalWithdrawnPix, setTotalWithdrawnPix] = useState<number>(0);
  const [totalCreditedNotWithdrawn, setTotalCreditedNotWithdrawn] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profile?.user_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Buscar contrato mais recente do usuário
      const { data: contractData } = await supabase
        .from('partner_contracts')
        .select('id, plan_name, aporte_value, total_cap, weekly_cap, total_received, cotas, status, created_at, closed_at, closed_reason, pix_key, pix_key_type')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!contractData) {
        setContract(null);
        setTermination(null);
        setPayouts([]);
        setReferralBonuses([]);
        return;
      }

      setContract(contractData as TerminationContract);

      // Buscar encerramento mais recente desse contrato
      const { data: termData } = await supabase
        .from('partner_early_terminations')
        .select('*')
        .eq('partner_contract_id', contractData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setTermination((termData as TerminationRecord) || null);

      // Payouts do contrato
      const { data: payoutsData } = await supabase
        .from('partner_payouts')
        .select('id, period_start, period_end, amount, calculated_amount, status, paid_at')
        .eq('partner_contract_id', contractData.id)
        .order('period_start', { ascending: false });
      setPayouts((payoutsData as TerminationPayoutItem[]) || []);

      // Bônus de indicação onde este contrato foi o RECEBEDOR (referrer)
      const { data: bonusesData } = await supabase
        .from('partner_referral_bonuses')
        .select('id, bonus_value, referral_level, status, created_at, referred_user_id')
        .eq('referrer_contract_id', contractData.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const rawBonuses: any[] = bonusesData || [];
      const bonusList: TerminationReferralBonus[] = rawBonuses.map((b) => ({
        id: b.id,
        bonus_amount: Number(b.bonus_value || 0),
        level: b.referral_level,
        status: b.status,
        created_at: b.created_at,
        source_user_name: null,
      }));

      // Buscar nomes dos usuários indicados
      const sourceIds = Array.from(new Set(rawBonuses.map((b) => b.referred_user_id).filter(Boolean))) as string[];
      if (sourceIds.length > 0) {
        const { data: profiles } = await supabase.rpc('get_public_profiles', { user_ids: sourceIds });
        const nameMap = new Map<string, string>(((profiles as any[]) || []).map((p) => [p.user_id, p.full_name]));
        bonusList.forEach((b, idx) => {
          const sourceId = rawBonuses[idx]?.referred_user_id;
          b.source_user_name = sourceId ? nameMap.get(sourceId) || null : null;
        });
      }
      setReferralBonuses(bonusList);


      // SLA do estorno
      const { data: setting } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'termination_refund_sla_days')
        .maybeSingle();
      if (setting?.setting_value) {
        const parsed = parseInt(setting.setting_value, 10);
        if (!isNaN(parsed) && parsed > 0) setSlaDays(parsed);
      }
    } catch (error) {
      console.error('[useTerminationDetails] erro:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { termination, contract, payouts, referralBonuses, slaDays, loading, refetch: fetchAll };
};
