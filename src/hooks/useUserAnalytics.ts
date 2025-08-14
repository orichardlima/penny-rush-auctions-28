import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserAnalytics {
  user_id: string;
  full_name: string;
  email: string;
  is_bot: boolean;
  total_spent: number;
  total_bids: number;
  auctions_participated: number;
  auctions_won: number;
  avg_bid_cost: number;
  first_activity: string;
  last_activity: string;
  user_classification: string;
  favorite_time_slot: string;
}

export const useUserAnalytics = (userId: string | null) => {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setAnalytics(null);
      return;
    }

    const fetchUserAnalytics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase.rpc('get_user_analytics', {
          user_uuid: userId
        });

        if (error) throw error;
        setAnalytics(data?.[0] || null);
      } catch (err) {
        console.error('Error fetching user analytics:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar analytics do usuário');
      } finally {
        setLoading(false);
      }
    };

    fetchUserAnalytics();
  }, [userId]);

  return { analytics, loading, error };
};