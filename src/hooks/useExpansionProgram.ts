import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const sb = supabase as any;

export interface ExpansionOverview {
  period_start: string;
  period_end: string;
  next_close_date: string;
  teams_count: number;
  total_points_available: number;
  week_points: number;
  largest_team_user_id: string | null;
  largest_team_points: number;
  other_teams_points: number;
  vqe_available: number;
  vqe_payable: number;
  bonus_percent: number;
  weekly_cap: number;
  estimated_bonus: number;
  carryforward_points: number;
  plan_name: string | null;
  has_active_contract: boolean;
  last_snapshot: {
    period_start: string;
    period_end: string;
    status_official: string;
    final_bonus: number;
    released_at: string | null;
  } | null;
  program: {
    points_generation_enabled: boolean;
    weekly_close_enabled: boolean;
    payout_enabled: boolean;
    official_start_at: string | null;
  };
}

export interface ExpansionTeam {
  team_root_user_id: string;
  name: string;
  avatar_url: string | null;
  plan_name: string | null;
  members_count: number;
  points_earned: number;
  points_consumed: number;
  points_available: number;
  week_points: number;
  share_pct: number;
  is_largest: boolean;
}

export interface ExpansionConsumption {
  team_root_user_id: string;
  team_name: string;
  role: string;
  points_available: number;
  points_consumed: number;
  balance_after: number;
}

export interface ExpansionSnapshot {
  id: string;
  period_start: string;
  period_end: string;
  plan_name: string | null;
  weekly_cap: number;
  largest_team_points: number;
  other_teams_points: number;
  largest_team_name: string | null;
  vqe_points: number;
  payable_vqe_points: number;
  bonus_percent: number;
  final_bonus: number;
  total_points_consumed: number;
  carryforward_points: number;
  status_official: string;
  closed_at: string | null;
  released_at: string | null;
  balances_before: Record<string, number> | null;
  balances_after: Record<string, number> | null;
  consumptions: ExpansionConsumption[];
}

export function useExpansionProgram() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<ExpansionOverview | null>(null);
  const [teams, setTeams] = useState<ExpansionTeam[]>([]);
  const [snapshots, setSnapshots] = useState<ExpansionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ov, tm, sn] = await Promise.all([
        sb.rpc('expansion_get_partner_overview', { _user_id: user.id }),
        sb.rpc('expansion_get_partner_teams', { _user_id: user.id }),
        sb.rpc('expansion_get_partner_snapshots', { _user_id: user.id }),
      ]);
      if (!ov.error) setOverview((ov.data || null) as ExpansionOverview | null);
      if (!tm.error) setTeams((tm.data || []) as ExpansionTeam[]);
      if (!sn.error) setSnapshots((sn.data || []) as ExpansionSnapshot[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { overview, teams, snapshots, loading, refresh: fetchAll };
}
