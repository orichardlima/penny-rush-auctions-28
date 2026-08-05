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

const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);
const arr = (v: any) => (Array.isArray(v) ? v : []);

function normalizeCareer(raw: any): ExpansionCareer | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    rank_key: raw.rank_key ?? 'NONE',
    rank_label: raw.rank_label ?? 'Sem graduação',
    diagnosed_rank: raw.diagnosed_rank ?? 'NONE',
    next_rank: raw.next_rank ?? null,
    next_rank_label: raw.next_rank_label ?? null,
    next_rank_required_points: num(raw.next_rank_required_points),
    next_rank_qualified_points: num(raw.next_rank_qualified_points),
    gross_career_points: num(raw.gross_career_points),
    reversed_career_points: num(raw.reversed_career_points),
    net_career_points: num(raw.net_career_points),
    qualified_rank_points: num(raw.qualified_rank_points),
    qualified_teams: num(raw.qualified_teams),
    total_teams_with_points: num(raw.total_teams_with_points),
    largest_team_points: num(raw.largest_team_points),
    largest_team_share_percent: num(raw.largest_team_share_percent),
    eligible_leaders: num(raw.eligible_leaders),
    distinct_leader_teams: num(raw.distinct_leader_teams),
    requirements_met: arr(raw.requirements_met),
    requirements_pending: arr(raw.requirements_pending),
    all_ranks: arr(raw.all_ranks),
    config_version: num(raw.config_version),
    config_effective_from: raw.config_effective_from ?? '',
  };
}

export function useExpansionCareer() {
  const { data: career, isLoading: loading, error, refetch: refresh } = useQuery({
    queryKey: ['expansion-career-my'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('expansion_partner_get_my_career');
      if (error) throw error;
      return normalizeCareer(data);
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
