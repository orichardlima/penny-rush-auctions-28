import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, DollarSign, TrendingUp, Star, Award } from 'lucide-react';

interface UserAnalytics {
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

interface UserSpendingAnalyticsProps {
  users: any[];
}

export const UserSpendingAnalytics: React.FC<UserSpendingAnalyticsProps> = ({ users }) => {
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');

  useEffect(() => {
    fetchUserAnalytics();
  }, []);

  const fetchUserAnalytics = async () => {
    try {
      setLoading(true);
      const realUsers = users.filter(user => !user.is_bot);
      
      // Buscar analytics para cada usuário
      const analyticsPromises = realUsers.map(async (user) => {
        const { data, error } = await supabase
          .rpc('get_user_analytics', { user_uuid: user.user_id });
        
        if (error) {
          console.error('Erro ao buscar analytics do usuário:', error);
          return null;
        }
        
        return data[0];
      });

      const results = await Promise.all(analyticsPromises);
      const validResults = results.filter(result => result !== null);
      
      // Ordenar por total gasto (maior primeiro)
      validResults.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
      
      setUserAnalytics(validResults);
    } catch (error) {
      console.error('Erro ao carregar analytics dos usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'VIP': return 'bg-purple-500/20 text-purple-700 border-purple-500/30';
      case 'Premium': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'Ativo': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'Casual': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'Inativo': return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case 'VIP': return <Star className="h-3 w-3" />;
      case 'Premium': return <Award className="h-3 w-3" />;
      case 'Ativo': return <TrendingUp className="h-3 w-3" />;
      default: return null;
    }
  };

  const filteredUsers = userAnalytics.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClassification = classificationFilter === 'all' || 
                                 user.user_classification === classificationFilter;
    
    return matchesSearch && matchesClassification;
  });

  // Calcular totais
  const totalSpent = userAnalytics.reduce((sum, user) => sum + (user.total_spent || 0), 0);
  const totalUsers = userAnalytics.length;
  const vipUsers = userAnalytics.filter(u => u.user_classification === 'VIP').length;
  const activeUsers = userAnalytics.filter(u => u.total_bids > 0).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalSpent)}
            </div>
            <p className="text-xs text-muted-foreground">
              Todos os usuários
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              De {totalUsers} usuários totais
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários VIP</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{vipUsers}</div>
            <p className="text-xs text-muted-foreground">
              R$ 100+ gastos
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(activeUsers > 0 ? totalSpent / activeUsers : 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por usuário ativo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Análise Detalhada de Usuários
          </CardTitle>
          <CardDescription>
            Comportamento e gastos dos usuários na plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={classificationFilter} onValueChange={setClassificationFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por classificação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as classificações</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="Premium">Premium</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Casual">Casual</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead className="text-right">Total Gasto</TableHead>
                <TableHead className="text-right">Lances</TableHead>
                <TableHead className="text-right">Leilões</TableHead>
                <TableHead className="text-right">Vitórias</TableHead>
                <TableHead className="text-right">Última Atividade</TableHead>
                <TableHead>Horário Favorito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.slice(0, 20).map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {user.full_name || 'Usuário ' + user.user_id.substring(0, 8)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`flex items-center gap-1 w-fit ${getClassificationColor(user.user_classification)}`}>
                      {getClassificationIcon(user.user_classification)}
                      {user.user_classification}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    {formatCurrency(user.total_spent || 0)}
                  </TableCell>
                  <TableCell className="text-right">{user.total_bids}</TableCell>
                  <TableCell className="text-right">{user.auctions_participated}</TableCell>
                  <TableCell className="text-right">
                    <span className={user.auctions_won > 0 ? 'text-blue-600 font-semibold' : ''}>
                      {user.auctions_won}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatDate(user.last_activity)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {user.favorite_time_slot}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};