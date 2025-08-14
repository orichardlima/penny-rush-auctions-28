import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Trophy, Target, Users } from 'lucide-react';

interface Auction {
  id: string;
  title: string;
  status: string;
  total_bids: number;
  current_price: number;
  company_revenue?: number;
  revenue_target?: number;
  market_value?: number;
  participants_count?: number;
  winner_name?: string;
  finished_at?: string;
}

interface TopPerformingAuctionsProps {
  auctions: Auction[];
}

export const TopPerformingAuctions: React.FC<TopPerformingAuctionsProps> = ({ auctions }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Em andamento';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getROI = (revenue: number, marketValue: number) => {
    if (marketValue === 0) return 0;
    return ((revenue / marketValue) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'finished': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'waiting': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };

  // Ordenar por receita da empresa (company_revenue) - maiores primeiro
  const sortedAuctions = [...auctions]
    .filter(auction => auction.company_revenue && auction.company_revenue > 0)
    .sort((a, b) => (b.company_revenue || 0) - (a.company_revenue || 0))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Top 3 Performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sortedAuctions.slice(0, 3).map((auction, index) => {
          const roi = getROI(auction.company_revenue || 0, auction.market_value || 0);
          const targetPercentage = auction.revenue_target 
            ? ((auction.company_revenue || 0) / auction.revenue_target) * 100 
            : 0;

          return (
            <Card key={auction.id} className={`relative ${index === 0 ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}>
              {index === 0 && (
                <div className="absolute -top-2 -right-2">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    #{index + 1} {auction.title.length > 25 ? auction.title.substring(0, 25) + '...' : auction.title}
                  </CardTitle>
                  <Badge className={getStatusColor(auction.status)}>
                    {auction.status === 'active' ? 'Ativo' : 
                     auction.status === 'finished' ? 'Finalizado' : 'Aguardando'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receita:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(auction.company_revenue || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ROI:</span>
                    <span className={`font-semibold flex items-center gap-1 ${roi >= 50 ? 'text-green-600' : 'text-orange-600'}`}>
                      {roi >= 50 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {roi.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lances:</span>
                    <span className="font-semibold">{auction.total_bids}</span>
                  </div>
                  {auction.winner_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vencedor:</span>
                      <span className="font-semibold text-blue-600">{auction.winner_name}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Ranking Completo de Performance
          </CardTitle>
          <CardDescription>
            Top 10 leilões por receita gerada para a empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Leilão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Lances</TableHead>
                <TableHead className="text-right">Finalizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAuctions.map((auction, index) => {
                const roi = getROI(auction.company_revenue || 0, auction.market_value || 0);
                const targetPercentage = auction.revenue_target 
                  ? ((auction.company_revenue || 0) / auction.revenue_target) * 100 
                  : 0;

                return (
                  <TableRow key={auction.id}>
                    <TableCell className="font-medium">
                      {index === 0 ? (
                        <div className="flex items-center gap-1">
                          <Trophy className="h-4 w-4 text-yellow-500" />
                          {index + 1}
                        </div>
                      ) : (
                        index + 1
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {auction.title.length > 30 ? auction.title.substring(0, 30) + '...' : auction.title}
                        </div>
                        {auction.winner_name && (
                          <div className="text-xs text-muted-foreground">
                            Vencedor: {auction.winner_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(auction.status)}>
                        {auction.status === 'active' ? 'Ativo' : 
                         auction.status === 'finished' ? 'Finalizado' : 'Aguardando'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatCurrency(auction.company_revenue || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {auction.revenue_target ? (
                        <div className="text-right">
                          <div className="text-sm">{formatCurrency(auction.revenue_target)}</div>
                          <div className={`text-xs ${targetPercentage >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                            ({targetPercentage.toFixed(0)}%)
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold flex items-center justify-end gap-1 ${roi >= 50 ? 'text-green-600' : 'text-orange-600'}`}>
                        {roi >= 50 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {roi.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {auction.total_bids}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDate(auction.finished_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};