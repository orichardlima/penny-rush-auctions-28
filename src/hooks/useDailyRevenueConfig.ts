import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DailyConfig {
  date: string;
  dayName: string;
  dayNumber: number;
  monthShort: string;
  percentage: number;
  calculationBase: 'aporte' | 'weekly_cap';
  estimatedValue: number;
  isConfigured: boolean;
  isPast: boolean;
  isToday: boolean;
}

interface WeekBounds {
  monday: Date;
  sunday: Date;
  weekValue: string;
}

interface PartnerPlan {
  name: string;
  display_name: string;
  aporte_value: number;
}

interface WeekProgress {
  weekStart: string;
  weekLabel: string;
  percentage: number;
  isCurrent: boolean;
  isSelected?: boolean;
  isFuture?: boolean;
}

interface MonthlyProgress {
  limit: number;
  accumulated: number;
  remaining: number;
  weeks: WeekProgress[];
}

interface UseDailyRevenueConfigResult {
  configs: DailyConfig[];
  weekTotal: {
    percentage: number;
    estimatedValue: number;
  };
  totalAportes: number;
  totalWeeklyCaps: number;
  loading: boolean;
  saving: boolean;
  calculationBase: 'aporte' | 'weekly_cap';
  setCalculationBase: (base: 'aporte' | 'weekly_cap') => void;
  description: string;
  setDescription: (desc: string) => void;
  updateDayPercentage: (date: string, percentage: number) => void;
  saveAllConfigs: () => Promise<void>;
  setSelectedWeek: (weekValue: string) => void;
  selectedWeek: string;
  weekBounds: WeekBounds;
  maxWeeklyPercentage: number;
  maxMonthlyPercentage: number;
  isOverLimit: boolean;
  remainingPercentage: number;
  partnerPlans: PartnerPlan[];
  monthlyProgress: MonthlyProgress;
}

// Helper: Format a Date to YYYY-MM-DD string using local time (avoids UTC issues)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get weeks grouped by month for selector
export const getWeeksForDailyConfig = (weeksCount: number = 12) => {
  const weeks: { value: string; label: string; monday: Date; sunday: Date }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const currentMonday = new Date(today);
  currentMonday.setHours(0, 0, 0, 0);
  currentMonday.setDate(today.getDate() + diffToMonday);
  
  for (let i = 0; i < weeksCount; i++) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - (i * 7));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(0, 0, 0, 0);
    
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    weeks.push({
      value: formatLocalDate(monday),
      label: `${formatDate(monday)} - ${formatDate(sunday)}`,
      monday,
      sunday
    });
  }
  
  return weeks;
};

export const useDailyRevenueConfig = (): UseDailyRevenueConfigResult => {
  const { user } = useAuth();
  const weeks = useMemo(() => getWeeksForDailyConfig(12), []);
  
  const [selectedWeek, setSelectedWeek] = useState<string>(weeks[0]?.value || '');
  const [dbConfigs, setDbConfigs] = useState<Record<string, { percentage: number; calculation_base: string }>>({});
  const [localConfigs, setLocalConfigs] = useState<Record<string, number>>({});
  const [calculationBase, setCalculationBase] = useState<'aporte' | 'weekly_cap'>('aporte');
  const [description, setDescription] = useState('');
  const [totalAportes, setTotalAportes] = useState(0);
  const [totalWeeklyCaps, setTotalWeeklyCaps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maxWeeklyPercentage, setMaxWeeklyPercentage] = useState<number>(10);
  const [maxMonthlyPercentage, setMaxMonthlyPercentage] = useState<number>(20);
  const [partnerPlans, setPartnerPlans] = useState<PartnerPlan[]>([]);
  const [monthlyWeeksData, setMonthlyWeeksData] = useState<Record<string, number>>({});

  // Current week bounds (fixed, based on today's date - doesn't change with selection)
  const currentWeekBounds = useMemo((): WeekBounds => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday, weekValue: formatLocalDate(monday) };
  }, []); // No dependencies - calculates once based on today

  // Calculate week bounds from selected week (for editing)
  const weekBounds = useMemo((): WeekBounds => {
    // Parse the date string as local time (not UTC) to avoid timezone issues
    const [year, month, day] = selectedWeek.split('-').map(Number);
    const monday = new Date(year, month - 1, day, 0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday, weekValue: selectedWeek };
  }, [selectedWeek]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Fetch existing configs for the week using local date formatting
        const mondayStr = formatLocalDate(weekBounds.monday);
        const sundayStr = formatLocalDate(weekBounds.sunday);
        
        const { data: configsData, error: configsError } = await supabase
          .from('daily_revenue_config')
          .select('*')
          .gte('date', mondayStr)
          .lte('date', sundayStr);

        if (configsError) throw configsError;

        const configsMap: Record<string, { percentage: number; calculation_base: string }> = {};
        configsData?.forEach(config => {
          configsMap[config.date] = {
            percentage: Number(config.percentage),
            calculation_base: config.calculation_base
          };
        });
        setDbConfigs(configsMap);
        
        // Set calculation base from first config found
        if (configsData && configsData.length > 0) {
          setCalculationBase(configsData[0].calculation_base as 'aporte' | 'weekly_cap');
          if (configsData[0].description) {
            setDescription(configsData[0].description);
          }
        }
        
        // Initialize local configs from db
        const localMap: Record<string, number> = {};
        configsData?.forEach(config => {
          localMap[config.date] = Number(config.percentage);
        });
        setLocalConfigs(localMap);

        // Fetch total active aportes
        const { data: activeContracts, error: contractsError } = await supabase
          .from('partner_contracts')
          .select('aporte_value, weekly_cap')
          .eq('status', 'ACTIVE');

        if (contractsError) throw contractsError;

        const totalAportes = activeContracts?.reduce((sum, c) => sum + Number(c.aporte_value), 0) || 0;
        const totalWeeklyCaps = activeContracts?.reduce((sum, c) => sum + Number(c.weekly_cap), 0) || 0;
        setTotalAportes(totalAportes);
        setTotalWeeklyCaps(totalWeeklyCaps);

        // Fetch max weekly percentage setting
        const { data: maxPercentageSetting } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'partner_max_weekly_percentage')
          .single();

        if (maxPercentageSetting) {
          setMaxWeeklyPercentage(Number(maxPercentageSetting.setting_value) || 10);
        }

        // Fetch max monthly percentage setting
        const { data: maxMonthlyPercentageSetting } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'partner_max_monthly_percentage')
          .single();

        if (maxMonthlyPercentageSetting) {
          setMaxMonthlyPercentage(Number(maxMonthlyPercentageSetting.setting_value) || 20);
        }

        // Fetch partner plans for example calculations
        const { data: plansData } = await supabase
          .from('partner_plans')
          .select('name, display_name, aporte_value')
          .eq('is_active', true)
          .order('aporte_value', { ascending: true });

        if (plansData) {
          setPartnerPlans(plansData);
        }

        // Fetch data for last 4 weeks (for monthly progress)
        const fourWeeksAgo = new Date(weekBounds.monday);
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 21); // 3 weeks back
        
        const { data: monthlyConfigsData } = await supabase
          .from('daily_revenue_config')
          .select('date, percentage')
          .gte('date', formatLocalDate(fourWeeksAgo))
          .lte('date', formatLocalDate(weekBounds.sunday));

        if (monthlyConfigsData) {
          // Group by week and calculate totals
          const weekTotals: Record<string, number> = {};
          
          monthlyConfigsData.forEach(config => {
            // Parse date as local
            const [year, month, day] = config.date.split('-').map(Number);
            const configDate = new Date(year, month - 1, day);
            
            // Find Monday of this config's week
            const dayOfWeek = configDate.getDay();
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(configDate);
            monday.setDate(configDate.getDate() + diffToMonday);
            const weekKey = formatLocalDate(monday);
            
            weekTotals[weekKey] = (weekTotals[weekKey] || 0) + Number(config.percentage);
          });
          
          setMonthlyWeeksData(weekTotals);
        }

      } catch (error) {
        console.error('Error fetching daily revenue config:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [weekBounds]);

  // Generate day configs
  const configs = useMemo((): DailyConfig[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    
    const result: DailyConfig[] = [];
    const baseTotal = calculationBase === 'aporte' ? totalAportes : totalWeeklyCaps;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekBounds.monday);
      date.setDate(weekBounds.monday.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const dayKey = formatLocalDate(date);
      const percentage = localConfigs[dayKey] ?? 0;
      const estimatedValue = baseTotal * (percentage / 100);
      
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      
      const isConfigured = dayKey in dbConfigs || (dayKey in localConfigs && localConfigs[dayKey] > 0);
      
      result.push({
        date: dayKey,
        dayName: dayNames[date.getDay()],
        dayNumber: date.getDate(),
        monthShort: monthNames[date.getMonth()],
        percentage,
        calculationBase,
        estimatedValue,
        isConfigured,
        isPast: dateOnly < today,
        isToday: dateOnly.getTime() === today.getTime()
      });
    }
    
    return result;
  }, [weekBounds, localConfigs, dbConfigs, calculationBase, totalAportes, totalWeeklyCaps]);

  // Calculate totals
  const weekTotal = useMemo(() => {
    const percentage = configs.reduce((sum, day) => sum + day.percentage, 0);
    const estimatedValue = configs.reduce((sum, day) => sum + day.estimatedValue, 0);
    return { percentage, estimatedValue };
  }, [configs]);

  // Calculate limit validation
  const isOverLimit = useMemo(() => {
    return weekTotal.percentage > maxWeeklyPercentage;
  }, [weekTotal.percentage, maxWeeklyPercentage]);

  const remainingPercentage = useMemo(() => {
    return Math.max(0, maxWeeklyPercentage - weekTotal.percentage);
  }, [weekTotal.percentage, maxWeeklyPercentage]);

  // Calculate monthly progress (current week + next 3 weeks - prospective view)
  // ALWAYS anchored to real current week, not the selected week for editing
  const monthlyProgress = useMemo((): MonthlyProgress => {
    const limit = maxMonthlyPercentage;
    const weeks: WeekProgress[] = [];
    
    // Generate current week + next 3 weeks (prospective view)
    // Use currentWeekBounds as anchor (fixed), not weekBounds (changes with selection)
    for (let i = 0; i < 4; i++) {
      const monday = new Date(currentWeekBounds.monday);
      monday.setDate(currentWeekBounds.monday.getDate() + (i * 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const weekKey = formatLocalDate(monday);
      const isCurrentWeek = weekKey === currentWeekBounds.weekValue;
      const isSelectedWeek = weekKey === selectedWeek;
      const isFuture = i > 0;
      
      // If it's the selected week, use weekTotal.percentage (real-time local values)
      // Otherwise, use data from database (monthlyWeeksData)
      let percentage = 0;
      if (isSelectedWeek) {
        percentage = weekTotal.percentage;
      } else {
        percentage = monthlyWeeksData[weekKey] || 0;
      }
      
      const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      weeks.push({
        weekStart: weekKey,
        weekLabel: `${formatDate(monday)} - ${formatDate(sunday)}`,
        percentage,
        isCurrent: isCurrentWeek,
        isSelected: isSelectedWeek,
        isFuture
      });
    }
    
    const accumulated = weeks.reduce((sum, w) => sum + w.percentage, 0);
    const remaining = Math.max(0, limit - accumulated);
    
    return { limit, accumulated, remaining, weeks };
  }, [currentWeekBounds, selectedWeek, weekTotal.percentage, monthlyWeeksData, maxMonthlyPercentage]);

  // Update day percentage locally
  const updateDayPercentage = useCallback((date: string, percentage: number) => {
    setLocalConfigs(prev => ({
      ...prev,
      [date]: Math.max(0, percentage)
    }));
  }, []);

  // Save all configs to database
  const saveAllConfigs = useCallback(async () => {
    if (!user) return;
    
    // Validate limit before saving
    if (isOverLimit) {
      toast.error(`Limite excedido! Máximo permitido: ${maxWeeklyPercentage}%`);
      return;
    }
    
    setSaving(true);
    
    try {
      // Prepare upsert data for all configured days
      const configsToSave = configs
        .filter(day => day.percentage > 0 || day.date in dbConfigs)
        .map(day => ({
          date: day.date,
          percentage: localConfigs[day.date] ?? 0,
          calculation_base: calculationBase,
          description: description || null,
          configured_by: user.id
        }));

      if (configsToSave.length === 0) {
        toast.info('Nenhuma configuração para salvar');
        setSaving(false);
        return;
      }

      // Upsert all configs
      const { error } = await supabase
        .from('daily_revenue_config')
        .upsert(configsToSave, { 
          onConflict: 'date',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Update dbConfigs to reflect saved state
      const newDbConfigs: Record<string, { percentage: number; calculation_base: string }> = {};
      configsToSave.forEach(config => {
        newDbConfigs[config.date] = {
          percentage: config.percentage,
          calculation_base: config.calculation_base
        };
      });
      setDbConfigs(prev => ({ ...prev, ...newDbConfigs }));

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving daily revenue config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }, [user, configs, localConfigs, calculationBase, description, dbConfigs, isOverLimit, maxWeeklyPercentage]);

  return {
    configs,
    weekTotal,
    totalAportes,
    totalWeeklyCaps,
    loading,
    saving,
    calculationBase,
    setCalculationBase,
    description,
    setDescription,
    updateDayPercentage,
    saveAllConfigs,
    setSelectedWeek,
    selectedWeek,
    weekBounds,
    maxWeeklyPercentage,
    maxMonthlyPercentage,
    isOverLimit,
    remainingPercentage,
    partnerPlans,
    monthlyProgress
  };
};
