import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Trophy, 
  Target, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Calendar,
  DollarSign
} from 'lucide-react';

interface AuctionParticipation {
  auction_id: string;
  auction_title: string;
  auction_status: string;
  auction_current_price: number;
  auction_winner_id?: string;
  bid_count: number;
  total_invested: number;
  last_bid_date: string;
  is_winner: boolean;
  roi?: number;
}

interface AuctionStats {
  totalParticipations: number;
  totalWins: number;
  totalInvested: number;
  averageInvestment: number;
  winRate: number;
  totalROI: number;
}

export const AuctionHistory = () => {
  const { profile } = useAuth();
  const [participations, setParticipations] = useState<AuctionParticipation[]>([]);
  const [stats, setStats] = useState<AuctionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'won' | 'finished'>('all');

  useEffect(() => {
    fetchAuctionHistory();
  }, []);

  const fetchAuctionHistory = async () => {
    try {
      // Buscar todos os lances do usuário com informações dos leilões
      const { data: bidsData } = await supabase
        .from('bids')
        .select(`
          auction_id,
          cost_paid,
          created_at,
          auctions (
            id,
            title,
            status,
            current_price,
            winner_id
          )
        `)
        .order('created_at', { ascending: false });

      if (bidsData) {
        processAuctionData(bidsData);
      }
    } catch (error) {
      console.error('Error fetching auction history:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAuctionData = (bidsData: any[]) => {
    // Agrupar lances por leilão
    const auctionGroups = bidsData.reduce((acc, bid) => {
      const auctionId = bid.auction_id;
      if (!acc[auctionId]) {
        acc[auctionId] = {
          auction_id: auctionId,
          auction_title: bid.auctions?.title || 'Leilão Desconhecido',
          auction_status: bid.auctions?.status || 'unknown',
          auction_current_price: bid.auctions?.current_price || 0,
          auction_winner_id: bid.auctions?.winner_id,
          bids: []
        };
      }
      acc[auctionId].bids.push(bid);
      return acc;
    }, {} as Record<string, any>);

    // Processar cada leilão
    const participations: AuctionParticipation[] = Object.values(auctionGroups).map((group: any) => {
      const totalInvested = group.bids.reduce((sum: number, bid: any) => sum + bid.cost_paid, 0);
      const isWinner = group.auction_winner_id === profile?.user_id;
      const lastBidDate = group.bids[0]?.created_at; // Já ordenado por data desc

      let roi: number | undefined;
      if (isWinner && group.auction_status === 'finished') {
        roi = group.auction_current_price > 0 
          ? ((group.auction_current_price - totalInvested) / totalInvested) * 100 
          : 0;
      }

      return {
        auction_id: group.auction_id,
        auction_title: group.auction_title,
        auction_status: group.auction_status,
        auction_current_price: group.auction_current_price,
        auction_winner_id: group.auction_winner_id,
        bid_count: group.bids.length,
        total_invested: totalInvested,
        last_bid_date: lastBidDate,
        is_winner: isWinner,
        roi
      };
    });

    // Calcular estatísticas
    const totalParticipations = participations.length;
    const totalWins = participations.filter(p => p.is_winner).length;
    const totalInvested = participations.reduce((sum, p) => sum + p.total_invested, 0);
    const averageInvestment = totalParticipations > 0 ? totalInvested / totalParticipations : 0;
    const winRate = totalParticipations > 0 ? (totalWins / totalParticipations) * 100 : 0;
    
    const totalROI = participations
      .filter(p => p.roi !== undefined)
      .reduce((sum, p) => sum + (p.roi || 0), 0);

    setParticipations(participations);
    setStats({
      totalParticipations,
      totalWins,
      totalInvested,
      averageInvestment,
      winRate,
      totalROI
    });
  };

  const filteredParticipations = participations.filter(p => {
    switch (filter) {
      case 'active':
        return p.auction_status === 'active';
      case 'won':
        return p.is_winner;
      case 'finished':
        return p.auction_status === 'finished';
      default:
        return true;
    }
  });

  const formatPrice = (priceInReais: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(priceInReais || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Meus Leilões</h2>
        <p className="text-muted-foreground">
          Histórico completo de participações e resultados
        </p>
      </div>

      {/* Cards de Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Participações</CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalParticipations}</div>
              <p className="text-xs text-muted-foreground">
                leilões participados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Vitória</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalWins} vitórias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Investimento Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(Math.round(stats.averageInvestment))}</div>
              <p className="text-xs text-muted-foreground">
                por leilão
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROI Total</CardTitle>
              {stats.totalROI >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.totalROI >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stats.totalROI.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                retorno sobre investimento
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Todos ({participations.length})
        </Button>
        <Button
          variant={filter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('active')}
        >
          <Clock className="w-4 h-4 mr-1" />
          Ativos ({participations.filter(p => p.auction_status === 'active').length})
        </Button>
        <Button
          variant={filter === 'won' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('won')}
        >
          <Trophy className="w-4 h-4 mr-1" />
          Ganhos ({participations.filter(p => p.is_winner).length})
        </Button>
        <Button
          variant={filter === 'finished' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('finished')}
        >
          Finalizados ({participations.filter(p => p.auction_status === 'finished').length})
        </Button>
      </div>

      {/* Tabela de Leilões */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Participações</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredParticipations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leilão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lances</TableHead>
                  <TableHead>Investido</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Última Atividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipations.map((participation) => (
                  <TableRow key={participation.auction_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{participation.auction_title}</div>
                        <div className="text-sm text-muted-foreground">
                          Preço atual: {formatPrice(participation.auction_current_price)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          participation.auction_status === 'active' ? 'default' :
                          participation.is_winner ? 'default' : 'secondary'
                        }
                        className={participation.is_winner ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : ''}
                      >
                        {participation.auction_status === 'active' ? 'Ativo' :
                         participation.is_winner ? 'Ganho' : 'Perdido'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <div className="font-medium">{participation.bid_count}</div>
                        <div className="text-xs text-muted-foreground">lances</div>
                      </div>
                    </TableCell>
                    <TableCell>{formatPrice(participation.total_invested)}</TableCell>
                    <TableCell>
                      {participation.is_winner ? (
                        <div className="flex items-center text-green-600">
                          <Trophy className="w-4 h-4 mr-1" />
                          <span className="font-medium">Venceu!</span>
                          {participation.roi !== undefined && (
                            <span className="ml-1 text-xs">
                              ({participation.roi > 0 ? '+' : ''}{participation.roi.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      ) : participation.auction_status === 'finished' ? (
                        <div className="text-muted-foreground">
                          Não ganhou
                        </div>
                      ) : (
                        <div className="text-blue-600">
                          Participando
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(participation.last_bid_date)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {filter === 'all' 
                  ? 'Você ainda não participou de nenhum leilão.'
                  : `Nenhum leilão encontrado para o filtro "${filter}".`
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};