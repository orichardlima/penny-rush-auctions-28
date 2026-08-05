import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ExpansionCareer {
  rank_key: string;
  rank_label: string;
  diagnosed_rank: string;
  next_rank: string | null;
  next_rank_label: string | null;
  next_rank_required_points: number;
  next_rank_qualified_points: number;
  gross_career_points: number;
  reversed_career_points: number;
  net_career_points: number;
  qualified_rank_points: number;
  qualified_teams: number;
  total_teams_with_points: number;
  largest_team_points: number;
  largest_team_share_percent: number;
  eligible_leaders: number;
  distinct_leader_teams: number;
  requirements_met: string[];
  requirements_pending: string[];
  all_ranks: any[];
  config_version: number;
  config_effective_from: string;
}

export function useExpansionCareer() {
  const { data: career, isLoading: loading, error, refetch: refresh } = useQuery({
    queryKey: ['expansion-career-my'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('expansion_partner_get_my_career');
      if (error) throw error;
      return data as unknown as ExpansionCareer;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    career,
    loading,
    error,
    refresh
  };
}
