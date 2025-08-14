import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityData {
  hour_of_day: number;
  day_of_week: number;
  bid_count: number;
  user_count: number;
  revenue: number;
}

export const useActivityHeatmap = () => {
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivityData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase.rpc('get_hourly_activity');

        if (error) throw error;
        setActivityData(data || []);
      } catch (err) {
        console.error('Error fetching activity data:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados de atividade');
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, []);

  return { activityData, loading, error };
};