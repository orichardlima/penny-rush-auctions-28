import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DailyRevenue {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthShort: string;
  partnerShare: number;
  grossRevenue: number;
  isPast: boolean;
  isToday: boolean;
  percentage: number;
  isManualConfig: boolean;
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
  weekly_cap: number;
  user_id: string;
}

interface DailyConfig {
  date: string;
  percentage: number;
  calculation_base: string;
}

export const useCurrentWeekRevenue = (contract: PartnerContract | null): CurrentWeekRevenueData => {
  const [dailyConfigs, setDailyConfigs] = useState<Record<string, DailyConfig>>({});
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

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
        const mondayStr = weekBounds.monday.toISOString().split('T')[0];
        const sundayStr = weekBounds.sunday.toISOString().split('T')[0];

        // Fetch daily revenue configs (admin-configured percentages)
        const { data: configsData, error: configsError } = await supabase
          .from('daily_revenue_config')
          .select('date, percentage, calculation_base')
          .gte('date', mondayStr)
          .lte('date', sundayStr);

        if (configsError) throw configsError;

        const configsMap: Record<string, DailyConfig> = {};
        configsData?.forEach(config => {
          configsMap[config.date] = {
            date: config.date,
            percentage: Number(config.percentage),
            calculation_base: config.calculation_base
          };
        });

        setDailyConfigs(configsMap);

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
        table: 'daily_revenue_config'
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
      const config = dailyConfigs[dayKey];
      
      let partnerShare = 0;
      let grossRevenue = 0;
      const percentage = config?.percentage || 0;
      const isManualConfig = !!config && percentage > 0;
      
      // Calculate partner share based on configured percentage
      if (contract && config && percentage > 0) {
        const baseValue = config.calculation_base === 'weekly_cap' 
          ? contract.weekly_cap 
          : contract.aporte_value;
        
        partnerShare = baseValue * (percentage / 100);
        
        // Apply weekly cap if base is aporte
        if (config.calculation_base === 'aporte' && partnerShare > contract.weekly_cap) {
          partnerShare = contract.weekly_cap;
        }
        
        // grossRevenue in this context represents the estimated total for display
        grossRevenue = partnerShare;
      }
      
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
        isToday: dateOnly.getTime() === today.getTime(),
        percentage,
        isManualConfig
      });
    }
    
    return result;
  }, [weekBounds, dailyConfigs, contract]);

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
