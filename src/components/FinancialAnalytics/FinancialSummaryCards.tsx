import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, Target, ShoppingCart, Activity } from 'lucide-react';

interface FinancialSummary {
  total_revenue: number;
  auction_revenue: number;
  package_revenue: number;
  total_auctions: number;
  active_auctions: number;
  finished_auctions: number;
  total_users: number;
  paying_users: number;
  average_auction_revenue: number;
  total_bids: number;
  user_bids: number;
  bot_bids: number;
  conversion_rate: number;
}

interface FinancialSummaryCardsProps {
  summary: FinancialSummary;
  loading?: boolean;
}

export const FinancialSummaryCards: React.FC<FinancialSummaryCardsProps> = ({ 
  summary, 
  loading = false 
}) => {
  const formatCurrency = (valueInReais: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valueInReais);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 bg-muted animate-pulse rounded w-24"></div>
              </CardTitle>
              <div className="h-4 w-4 bg-muted animate-pulse rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded w-20 mb-1"></div>
              <div className="h-3 bg-muted animate-pulse rounded w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Receita Real (Caixa)",
      value: formatCurrency(summary.package_revenue),
      description: "Pagamentos confirmados de pacotes",
      icon: DollarSign,
      color: "text-green-600"
    },
    {
      title: "Lances Consumidos",
      value: formatCurrency(summary.auction_revenue),
      description: "Valor de lances usados em leilões (informativo)",
      icon: Activity,
      color: "text-blue-600"
    },
    {
      title: "Média por Leilão",
      value: formatCurrency(summary.average_auction_revenue),
      description: "Receita média",
      icon: Target,
      color: "text-orange-600"
    },
    {
      title: "Taxa de Conversão",
      value: formatPercentage(summary.conversion_rate),
      description: `${summary.paying_users} de ${summary.total_users} usuários`,
      icon: Users,
      color: "text-emerald-600"
    },
    {
      title: "Leilões Ativos",
      value: summary.active_auctions.toString(),
      description: `${summary.total_auctions} total`,
      icon: Activity,
      color: "text-red-600"
    },
    {
      title: "Lances de Usuários",
      value: summary.user_bids.toString(),
      description: `${((summary.user_bids / summary.total_bids) * 100).toFixed(1)}% do total`,
      icon: Users,
      color: "text-green-600"
    },
    {
      title: "Lances de Bots",
      value: summary.bot_bids.toString(),
      description: `${((summary.bot_bids / summary.total_bids) * 100).toFixed(1)}% do total`,
      icon: Activity,
      color: "text-yellow-600"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};