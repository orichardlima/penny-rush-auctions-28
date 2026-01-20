import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinancialSummaryCards } from '@/components/FinancialAnalytics/FinancialSummaryCards';
import { RevenueChart } from '@/components/FinancialAnalytics/RevenueChart';
import { BidAnalytics } from '@/components/FinancialAnalytics/BidAnalytics';
import { TopPerformingAuctions } from '@/components/AdminFinancial/TopPerformingAuctions';
import { UserSpendingAnalytics } from '@/components/AdminFinancial/UserSpendingAnalytics';
import { ConversionFunnelChart } from '@/components/AdminFinancial/ConversionFunnelChart';
import { FinancialFiltersComponent } from '@/components/FinancialAnalytics/FinancialFilters';
import { useFinancialAnalytics, FinancialFilters } from '@/hooks/useFinancialAnalytics';
import { TrendingUp, DollarSign, Users, Target, BarChart3, PieChart } from 'lucide-react';

interface AdminFinancialOverviewProps {
  auctions: any[];
  users: any[];
}

export const AdminFinancialOverview: React.FC<AdminFinancialOverviewProps> = ({
  auctions,
  users
}) => {
  const [filters, setFilters] = useState<FinancialFilters>({
    startDate: null,
    endDate: null,
    realOnly: false,
    revenueType: 'all',
    period: '30d'
  });

  const { summary, revenueTrends, loading, error } = useFinancialAnalytics(filters);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Erro ao Carregar Dados Financeiros</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalActiveAuctions = auctions.filter(a => a.status === 'active').length;
  const totalFinishedAuctions = auctions.filter(a => a.status === 'finished').length;
  const totalSystemUsers = users.filter(u => !u.is_bot).length;
  const totalBids = auctions.reduce((sum, auction) => sum + (auction.total_bids || 0), 0);

  return (
    <div className="space-y-6">
      {/* Financial Filters */}
      <FinancialFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {summary?.total_revenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Leilões + Pacotes de Lances
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {summary?.conversion_rate?.toFixed(1) || '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              Usuários que compraram pacotes
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Pagantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              {summary?.paying_users || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              De {summary?.total_users || 0} usuários totais
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Média/Leilão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              R$ {summary?.average_auction_revenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.finished_auctions || 0} leilões finalizados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Financial Summary */}
      <FinancialSummaryCards summary={summary} loading={loading} />

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-1">
          <TabsTrigger value="revenue" className="flex items-center gap-1 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 hidden sm:block" />
            <span className="sm:hidden">Receita</span>
            <span className="hidden sm:inline">Evolução da Receita</span>
          </TabsTrigger>
          <TabsTrigger value="bids" className="flex items-center gap-1 text-xs sm:text-sm">
            <PieChart className="h-4 w-4 hidden sm:block" />
            <span className="sm:hidden">Lances</span>
            <span className="hidden sm:inline">Análise de Lances</span>
          </TabsTrigger>
          <TabsTrigger value="auctions" className="flex items-center gap-1 text-xs sm:text-sm">
            <Target className="h-4 w-4 hidden sm:block" />
            <span className="sm:hidden">Top</span>
            <span className="hidden sm:inline">Top Leilões</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-1 text-xs sm:text-sm">
            <Users className="h-4 w-4 hidden sm:block" />
            <span className="sm:hidden">Usuários</span>
            <span className="hidden sm:inline">Análise de Usuários</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          <RevenueChart data={revenueTrends} loading={loading} />
          <ConversionFunnelChart summary={summary} />
        </TabsContent>

        <TabsContent value="bids" className="space-y-6">
          <BidAnalytics 
            totalBids={summary?.total_bids || 0}
            userBids={summary?.user_bids || 0}
            botBids={summary?.bot_bids || 0}
            auctionData={auctions.slice(0, 10).map(auction => ({
              title: auction.title.length > 20 ? auction.title.substring(0, 20) + '...' : auction.title,
              user_bids_count: Math.floor((auction.total_bids || 0) * 0.7), // Estimativa
              bot_bids_count: Math.floor((auction.total_bids || 0) * 0.3), // Estimativa
              total_bids_count: auction.total_bids || 0,
            }))}
          />
        </TabsContent>

        <TabsContent value="auctions" className="space-y-6">
          <TopPerformingAuctions auctions={auctions} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserSpendingAnalytics users={users} />
        </TabsContent>
      </Tabs>
    </div>
  );
};