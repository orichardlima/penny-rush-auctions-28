import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Flame, Trophy, TrendingUp, Award } from 'lucide-react';

interface VaultStat {
  record_value: number;
  total_distributed: number;
  completed_vaults: number;
  weekly_best: number;
}

interface TopWinner {
  user_id: string;
  user_name: string;
  total_won: number;
}

export const FuryVaultStats: React.FC = () => {
  const [stats, setStats] = useState<VaultStat>({ record_value: 0, total_distributed: 0, completed_vaults: 0, weekly_best: 0 });
  const [topWinners, setTopWinners] = useState<TopWinner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch completed vault instances
      const { data: instances } = await supabase
        .from('fury_vault_instances')
        .select('current_value, distributed_at, status')
        .eq('status', 'completed');

      if (instances && instances.length > 0) {
        const record = Math.max(...instances.map(i => i.current_value));
        const totalDist = instances.reduce((sum, i) => sum + i.current_value, 0);

        // Weekly best (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekInstances = instances.filter(i => i.distributed_at && new Date(i.distributed_at) >= weekAgo);
        const weekBest = weekInstances.length > 0 ? Math.max(...weekInstances.map(i => i.current_value)) : 0;

        setStats({
          record_value: record,
          total_distributed: totalDist,
          completed_vaults: instances.length,
          weekly_best: weekBest,
        });
      }

      // Fetch top winners from logs
      const { data: logsData } = await supabase
        .from('fury_vault_logs')
        .select('amount, details')
        .in('event_type', ['distribution_top', 'distribution_raffle']);

      if (logsData) {
        const winnerMap: Record<string, { name: string; total: number }> = {};
        for (const log of logsData) {
          const details = log.details as any;
          if (details?.user_id) {
            if (!winnerMap[details.user_id]) {
              winnerMap[details.user_id] = { name: details.user_name || 'Anônimo', total: 0 };
            }
            winnerMap[details.user_id].total += log.amount;
          }
        }
        const sorted = Object.entries(winnerMap)
          .map(([user_id, data]) => ({ user_id, user_name: data.name, total_won: data.total }))
          .sort((a, b) => b.total_won - a.total_won)
          .slice(0, 5);
        setTopWinners(sorted);
      }
    } catch (error) {
      console.error('Error fetching vault stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (loading) return null;
  if (stats.completed_vaults === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-destructive" />
        <h3 className="text-lg font-semibold">Estatísticas do Cofre Fúria</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Recorde</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-accent">{formatPrice(stats.record_value)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Melhor da Semana</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatPrice(stats.weekly_best)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Distribuído</CardTitle>
            <Award className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatPrice(stats.total_distributed)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Cofres Completados</CardTitle>
            <Flame className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.completed_vaults}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top winners */}
      {topWinners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Ranking de Maiores Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topWinners.map((winner, i) => (
                <div key={winner.user_id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={i === 0 ? 'default' : 'secondary'} className="w-6 h-6 flex items-center justify-center p-0 text-xs">
                      {i + 1}
                    </Badge>
                    <span className="text-sm font-medium">{winner.user_name}</span>
                  </div>
                  <span className="font-bold text-accent">{formatPrice(winner.total_won)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
