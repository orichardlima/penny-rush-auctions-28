import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PartnerContractRow {
  id: string;
  plan_name: string;
  aporte_value: number;
  weekly_cap: number;
  total_cap: number;
  cotas: number;
  bonus_bids_received: number | null;
  status: string;
  created_at: string;
  closed_at: string | null;
}

export interface BettorContractInfo {
  accepted_at: string | null; // null = fallback para created_at
  version: string | null;
  fallback_date: string | null;
}

export const useMeusContratos = () => {
  const { user } = useAuth();
  const [partnerContracts, setPartnerContracts] = useState<PartnerContractRow[]>([]);
  const [bettor, setBettor] = useState<BettorContractInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const [{ data: profile }, { data: contracts }] = await Promise.all([
        supabase
          .from('profiles')
          .select('bettor_contract_accepted_at, bettor_contract_version, created_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('partner_contracts')
          .select(
            'id, plan_name, aporte_value, weekly_cap, total_cap, cotas, bonus_bids_received, status, created_at, closed_at'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      setBettor({
        accepted_at: profile?.bettor_contract_accepted_at ?? null,
        version: profile?.bettor_contract_version ?? null,
        fallback_date: profile?.created_at ?? null,
      });
      setPartnerContracts((contracts as PartnerContractRow[]) ?? []);
      setLoading(false);
    };

    load();
  }, [user]);

  return { bettor, partnerContracts, loading };
};
