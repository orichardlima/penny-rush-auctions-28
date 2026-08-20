import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PartnerCreditLine {
  id: string;
  user_id: string;
  limit_amount: number;
  used_amount: number;
  default_term_days: number;
  status: string;
  notes: string | null;
}

export interface PartnerCreditDebt {
  id: string;
  credit_line_id: string;
  user_id: string;
  referred_email: string | null;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export const usePartnerCredit = () => {
  const { user } = useAuth();
  const [creditLine, setCreditLine] = useState<PartnerCreditLine | null>(null);
  const [debts, setDebts] = useState<PartnerCreditDebt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setCreditLine(null);
      setDebts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ data: line }, { data: debtRows }] = await Promise.all([
      supabase
        .from('partner_credit_lines')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('partner_credit_debts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    setCreditLine((line as any) || null);
    setDebts((debtRows as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const availableCredit = creditLine && creditLine.status === 'ACTIVE'
    ? Math.max(0, Number(creditLine.limit_amount) - Number(creditLine.used_amount))
    : 0;

  const openDebts = debts.filter(d => d.status === 'OPEN' || d.status === 'OVERDUE');
  const isBlocked = openDebts.some(d => d.status === 'OVERDUE');
  const totalOpen = openDebts.reduce((sum, d) => sum + Number(d.amount), 0);

  return {
    creditLine,
    debts,
    openDebts,
    availableCredit,
    isBlocked,
    totalOpen,
    hasCredit: !!creditLine && creditLine.status === 'ACTIVE',
    loading,
    refetch: fetchData,
  };
};
