import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ContractBalance {
  contract_id: string;
  contract_status: string;
  total_received: number;
  total_cap: number;
  cap_remaining: number;
  repass_credited: number;
  repass_withdrawn: number;
  repass_reserved: number;
  available: number;
}

export interface WithdrawalBalances {
  user_id: string;
  contracts: ContractBalance[];
  repass_credited: number;
  repass_reserved: number;
  repass_withdrawn: number;
  repass_available: number;
  bonus_total_credited: number;
  bonus_total_adjusted: number;
  bonus_total_withdrawn: number;
  bonus_reserved: number;
  bonus_available: number;
  bonus_by_type: Record<string, number>;
  total_reserved: number;
  total_available: number;
}

const EMPTY: WithdrawalBalances = {
  user_id: '',
  contracts: [],
  repass_credited: 0,
  repass_reserved: 0,
  repass_withdrawn: 0,
  repass_available: 0,
  bonus_total_credited: 0,
  bonus_total_adjusted: 0,
  bonus_total_withdrawn: 0,
  bonus_reserved: 0,
  bonus_available: 0,
  bonus_by_type: {},
  total_reserved: 0,
  total_available: 0,
};

const toNumber = (v: unknown) => Number(v ?? 0) || 0;

/**
 * Saldos de saque separados por origem:
 * - Repasses da Parceria (por contrato)
 * - Bônus de Rede (carteira independente)
 */
export const useWithdrawalBalances = () => {
  const { profile } = useAuth();
  const [balances, setBalances] = useState<WithdrawalBalances>(EMPTY);
  const [loading, setLoading] = useState(true);

  const fetchBalances = useCallback(async () => {
    if (!profile?.user_id) {
      setBalances(EMPTY);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('partner_get_withdrawal_balances', {
        _user_id: profile.user_id,
      });
      if (error) throw error;

      const raw = (data ?? {}) as Record<string, any>;
      setBalances({
        ...EMPTY,
        ...raw,
        user_id: raw.user_id ?? profile.user_id,
        contracts: (raw.contracts ?? []).map((c: Record<string, any>) => ({
          contract_id: c.contract_id,
          contract_status: c.contract_status,
          total_received: toNumber(c.total_received),
          total_cap: toNumber(c.total_cap),
          cap_remaining: toNumber(c.cap_remaining),
          repass_credited: toNumber(c.repass_credited),
          repass_withdrawn: toNumber(c.repass_withdrawn),
          repass_reserved: toNumber(c.repass_reserved),
          available: toNumber(c.available),
        })),
        repass_credited: toNumber(raw.repass_credited),
        repass_reserved: toNumber(raw.repass_reserved),
        repass_withdrawn: toNumber(raw.repass_withdrawn),
        repass_available: toNumber(raw.repass_available),
        bonus_total_credited: toNumber(raw.bonus_total_credited),
        bonus_total_adjusted: toNumber(raw.bonus_total_adjusted),
        bonus_total_withdrawn: toNumber(raw.bonus_total_withdrawn),
        bonus_reserved: toNumber(raw.bonus_reserved),
        bonus_available: toNumber(raw.bonus_available),
        bonus_by_type: (raw.bonus_by_type ?? {}) as Record<string, number>,
        total_reserved: toNumber(raw.total_reserved),
        total_available: toNumber(raw.total_available),
      });
    } catch (err) {
      console.error('Erro ao carregar saldos de saque:', err);
      setBalances(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { balances, loading, refetch: fetchBalances };
};
