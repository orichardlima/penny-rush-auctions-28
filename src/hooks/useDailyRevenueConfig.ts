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
}

// Get weeks grouped by month for selector
export const getWeeksForDailyConfig = (weeksCount: number = 12) => {
  const weeks: { value: string; label: string; monday: Date; sunday: Date }[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const currentMonday = new Date(today);
  currentMonday.setHours(0, 0, 0, 0);
  currentMonday.setDate(today.getDate() + diffToMonday);
  
  for (let i = 0; i < weeksCount; i++) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - (i * 7));
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    weeks.push({
      value: monday.toISOString().split('T')[0],
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

  // Calculate week bounds from selected week
  const weekBounds = useMemo((): WeekBounds => {
    const monday = new Date(selectedWeek);
    monday.setHours(0, 0, 0, 0);
    
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
        // Fetch existing configs for the week
        const mondayStr = weekBounds.monday.toISOString().split('T')[0];
        const sundayStr = weekBounds.sunday.toISOString().split('T')[0];
        
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
      
      const dayKey = date.toISOString().split('T')[0];
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
  }, [user, configs, localConfigs, calculationBase, description, dbConfigs]);

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
    weekBounds
  };
};
