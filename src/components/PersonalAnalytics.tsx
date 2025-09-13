import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, TrendingDown, Target, Trophy, DollarSign, Calendar, Award, Activity } from 'lucide-react';

interface UserStats {
  totalBids: number;
  totalSpent: number;
  auctionsWon: number;
  auctionsParticipated: number;
  averageBidAmount: number;
  winRate: number;
  totalSaved: number;
  currentStreak: number;
}

interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export const PersonalAnalytics = () => {
  const [stats, setStats] = useState<UserStats>({
    totalBids: 0,
    totalSpent: 0,
    auctionsWon: 0,
    auctionsParticipated: 0,
    averageBidAmount: 0,
    winRate: 0,
    totalSaved: 0,
    currentStreak: 0,
  });
  const [weeklyData, setWeeklyData] = useState<ChartData[]>([]);
  const [categoryData, setCategoryData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (user) {
      fetchUserAnalytics();
    }
  }, [user]);

  const fetchUserAnalytics = async () => {
    try {
      setLoading(true);

      // Buscar estatísticas de lances
      const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select('bid_amount, cost_paid, created_at, auction_id')
        .eq('user_id', user?.id);

      if (bidsError) throw bidsError;

      // Buscar leilões ganhos
      const { data: wonAuctions, error: wonError } = await supabase
        .from('auctions')
        .select('id, title, current_price, market_value, finished_at')
        .eq('winner_id', user?.id);

      if (wonError) throw wonError;

      // Buscar compras de pacotes
      const { data: purchases, error: purchasesError } = await supabase
        .from('bid_purchases')
        .select('amount_paid, created_at, bids_purchased')
        .eq('user_id', user?.id)
        .eq('payment_status', 'approved');

      if (purchasesError) throw purchasesError;

      // Calcular estatísticas
      const totalBids = bids?.length || 0;
      const totalSpent = purchases?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
      const auctionsWon = wonAuctions?.length || 0;
      const uniqueAuctions = new Set(bids?.map(b => b.auction_id)).size;
      const totalSaved = wonAuctions?.reduce((sum, auction) => 
        sum + ((auction.market_value || 0) - (auction.current_price || 0)), 0) || 0;

      setStats({
        totalBids,
        totalSpent,
        auctionsWon,
        auctionsParticipated: uniqueAuctions,
        averageBidAmount: totalBids > 0 ? totalSpent / totalBids : 0,
        winRate: uniqueAuctions > 0 ? (auctionsWon / uniqueAuctions) * 100 : 0,
        totalSaved,
        currentStreak: Math.floor(Math.random() * 5) + 1, // Placeholder - seria calculado baseado em vitórias consecutivas
      });

      // Dados semanais (últimas 7 semanas)
      const weeklyStats = [];
      for (let i = 6; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekBids = bids?.filter(bid => {
          const bidDate = new Date(bid.created_at);
          return bidDate >= weekStart && bidDate <= weekEnd;
        }).length || 0;

        weeklyStats.push({
          name: `Semana ${7 - i}`,
          value: weekBids,
        });
      }
      setWeeklyData(weeklyStats);

      // Dados por categoria (simulado - seria baseado em categorias reais)
      const categories = [
        { name: 'Eletrônicos', value: Math.floor(totalBids * 0.4), color: '#8884d8' },
        { name: 'Casa & Jardim', value: Math.floor(totalBids * 0.3), color: '#82ca9d' },
        { name: 'Moda', value: Math.floor(totalBids * 0.2), color: '#ffc658' },
        { name: 'Outros', value: Math.floor(totalBids * 0.1), color: '#ff7c7c' },
      ];
      setCategoryData(categories);

    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, trend, color = "default" }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color === 'success' ? 'text-success' : color === 'warning' ? 'text-warning' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <div className={`flex items-center text-xs ${trend > 0 ? 'text-success' : 'text-destructive'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(trend)}% em relação ao mês passado
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Lances"
          value={stats.totalBids}
          icon={Target}
          trend={12}
        />
        <StatCard
          title="Leilões Ganhos"
          value={stats.auctionsWon}
          icon={Trophy}
          color="success"
          trend={8}
        />
        <StatCard
          title="Total Investido"
          value={formatCurrency(stats.totalSpent)}
          icon={DollarSign}
          trend={-3}
        />
        <StatCard
          title="Economia Total"
          value={formatCurrency(stats.totalSaved)}
          icon={Award}
          color="success"
          trend={25}
        />
      </div>

      {/* Métricas avançadas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Taxa de Vitória</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{stats.winRate.toFixed(1)}%</div>
            <Progress value={stats.winRate} className="mb-2" />
            <p className="text-xs text-muted-foreground">
              {stats.auctionsWon} vitórias em {stats.auctionsParticipated} leilões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sequência Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{stats.currentStreak}</div>
            <Badge variant={stats.currentStreak > 3 ? "default" : "secondary"}>
              {stats.currentStreak > 3 ? "🔥 Em chamas!" : "Continue tentando!"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">ROI Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {stats.auctionsWon > 0 ? ((stats.totalSaved / stats.totalSpent) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Retorno sobre investimento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>
        
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lances por Semana</CardTitle>
              <CardDescription>Sua atividade nas últimas 7 semanas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lances por Categoria</CardTitle>
              <CardDescription>Distribuição dos seus lances</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};