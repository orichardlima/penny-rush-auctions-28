import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemSettings } from './useSystemSettings';

interface DailyRevenue {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthShort: string;
  partnerShare: number;
  grossRevenue: number;
  isPast: boolean;
  isToday: boolean;
}

interface CurrentWeekRevenueData {
  days: DailyRevenue[];
  totalPartnerShare: number;
  totalGrossRevenue: number;
  percentageOfAporte: number;
  maxDailyValue: number;
  loading: boolean;
  isAnimating: boolean;
}

interface PartnerContract {
  id: string;
  aporte_value: number;
  user_id: string;
}

export const useCurrentWeekRevenue = (contract: PartnerContract | null): CurrentWeekRevenueData => {
  const [dailyRevenues, setDailyRevenues] = useState<Record<string, number>>({});
  const [totalActiveAportes, setTotalActiveAportes] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const { getSettingValue } = useSystemSettings();
  const partnerFundPercentage = getSettingValue('partner_fund_percentage', 20);

  // Get current week bounds (Monday to Sunday)
  const weekBounds = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(today.getDate() + diffToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday };
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!contract) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setIsAnimating(false);

      try {
        // Fetch bid purchases for the current week
        const { data: purchases, error: purchasesError } = await supabase
          .from('bid_purchases')
          .select('amount_paid, created_at')
          .eq('payment_status', 'approved')
          .gte('created_at', weekBounds.monday.toISOString())
          .lte('created_at', weekBounds.sunday.toISOString());

        if (purchasesError) throw purchasesError;

        // Group by day
        const revenueByDay: Record<string, number> = {};
        purchases?.forEach(purchase => {
          const date = new Date(purchase.created_at);
          const dayKey = date.toISOString().split('T')[0];
          revenueByDay[dayKey] = (revenueByDay[dayKey] || 0) + (purchase.amount_paid || 0);
        });

        setDailyRevenues(revenueByDay);

        // Fetch total active aportes
        const { data: activeContracts, error: contractsError } = await supabase
          .from('partner_contracts')
          .select('aporte_value')
          .eq('status', 'ACTIVE');

        if (contractsError) throw contractsError;

        const totalAportes = activeContracts?.reduce((sum, c) => sum + c.aporte_value, 0) || 0;
        setTotalActiveAportes(totalAportes);

        // Trigger animation after data loads
        setTimeout(() => {
          setIsAnimating(true);
        }, 100);
      } catch (error) {
        console.error('Error fetching current week revenue:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('current-week-revenue')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bid_purchases'
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contract, weekBounds]);

  // Calculate daily data
  const days = useMemo((): DailyRevenue[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    
    const result: DailyRevenue[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekBounds.monday);
      date.setDate(weekBounds.monday.getDate() + i);
      
      const dayKey = date.toISOString().split('T')[0];
      const grossRevenue = dailyRevenues[dayKey] || 0;
      
      // Calculate partner share
      const partnerFund = grossRevenue * (partnerFundPercentage / 100);
      const partnerShare = totalActiveAportes > 0 && contract
        ? (contract.aporte_value / totalActiveAportes) * partnerFund
        : 0;
      
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      
      result.push({
        date,
        dayName: dayNames[date.getDay()],
        dayNumber: date.getDate(),
        monthShort: monthNames[date.getMonth()],
        partnerShare,
        grossRevenue,
        isPast: dateOnly < today,
        isToday: dateOnly.getTime() === today.getTime()
      });
    }
    
    return result;
  }, [weekBounds, dailyRevenues, partnerFundPercentage, totalActiveAportes, contract]);

  // Calculate totals
  const totalPartnerShare = useMemo(() => {
    return days.reduce((sum, day) => sum + day.partnerShare, 0);
  }, [days]);

  const totalGrossRevenue = useMemo(() => {
    return days.reduce((sum, day) => sum + day.grossRevenue, 0);
  }, [days]);

  const percentageOfAporte = useMemo(() => {
    if (!contract || contract.aporte_value === 0) return 0;
    return (totalPartnerShare / contract.aporte_value) * 100;
  }, [totalPartnerShare, contract]);

  const maxDailyValue = useMemo(() => {
    const max = Math.max(...days.map(d => d.partnerShare), 0.01);
    return max;
  }, [days]);

  return {
    days,
    totalPartnerShare,
    totalGrossRevenue,
    percentageOfAporte,
    maxDailyValue,
    loading,
    isAnimating
  };
};
