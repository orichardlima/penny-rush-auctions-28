import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Users, Target, DollarSign, Zap } from 'lucide-react';
import { useFinancialAnalytics } from '@/hooks/useFinancialAnalytics';

const AdvancedAnalytics: React.FC = () => {
  const { summary, loading } = useFinancialAnalytics();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="animate-pulse p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calcular métricas avançadas
  const userConversionRate = summary?.total_users ? 
    (summary.paying_users / summary.total_users * 100) : 0;
  
  const avgRevenuePerUser = summary?.paying_users ? 
    (summary.total_revenue / summary.paying_users) : 0;
  
  const bidEfficiency = summary?.total_bids ? 
    (summary.auction_revenue / summary.total_bids) : 0;

  const botPercentage = summary?.total_bids ? 
    (summary.bot_bids / summary.total_bids * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPIs Executivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {summary?.total_revenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Leilões: R$ {summary?.auction_revenue?.toFixed(2) || '0.00'} | 
              Pacotes: R$ {summary?.package_revenue?.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {userConversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.paying_users || 0} de {summary?.total_users || 0} usuários
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita por Usuário</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              R$ {avgRevenuePerUser.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              ARPU (Average Revenue Per User)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiência de Lances</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              R$ {bidEfficiency.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita média por lance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas de Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance de Leilões
            </CardTitle>
            <CardDescription>
              Análise da efetividade dos leilões
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-600">Leilões Ativos</p>
                <p className="text-3xl font-bold text-green-600">{summary?.active_auctions || 0}</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-600">Leilões Finalizados</p>
                <p className="text-3xl font-bold text-blue-600">{summary?.finished_auctions || 0}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Receita Média por Leilão</span>
                <Badge variant="outline">
                  R$ {summary?.average_auction_revenue?.toFixed(2) || '0.00'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total de Leilões</span>
                <Badge variant="outline">
                  {summary?.total_auctions || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Análise de Usuários
            </CardTitle>
            <CardDescription>
              Comportamento e engajamento dos usuários
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-primary/5 rounded-lg">
                <p className="text-sm font-medium text-primary">Usuários Totais</p>
                <p className="text-3xl font-bold text-primary">{summary?.total_users || 0}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-600">Usuários Pagantes</p>
                <p className="text-3xl font-bold text-green-600">{summary?.paying_users || 0}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total de Lances</span>
                <Badge variant="outline">
                  {summary?.total_bids || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Lances de Usuários</span>
                <Badge variant="default">
                  {summary?.user_bids || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Lances de Bots</span>
                <Badge variant="secondary">
                  {summary?.bot_bids || 0} ({botPercentage.toFixed(1)}%)
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights e Recomendações */}
      <Card>
        <CardHeader>
          <CardTitle>Insights e Recomendações</CardTitle>
          <CardDescription>
            Análise automatizada baseada nos dados atuais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">💡 Conversão</h4>
              <p className="text-sm text-blue-700">
                {userConversionRate < 10 
                  ? "Taxa de conversão baixa. Considere melhorar as estratégias de engajamento e ofertas de pacotes iniciais."
                  : userConversionRate < 25
                  ? "Taxa de conversão moderada. Oportunidade de otimizar campanhas de marketing direto."
                  : "Excelente taxa de conversão! Mantenha as estratégias atuais e expanda para novos usuários."
                }
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">📈 Receita</h4>
              <p className="text-sm text-green-700">
                {avgRevenuePerUser < 50 
                  ? "ARPU baixo. Considere criar pacotes premium e programas de fidelidade."
                  : avgRevenuePerUser < 150
                  ? "ARPU moderado. Oportunidade de cross-sell e upsell."
                  : "Excelente ARPU! Foque em retenção e programas VIP."
                }
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-2">🤖 Bot Strategy</h4>
              <p className="text-sm text-purple-700">
                {botPercentage > 50 
                  ? "Alto uso de bots. Certifique-se de que isso não afete a experiência do usuário."
                  : botPercentage > 25
                  ? "Uso equilibrado de bots. Monitore a efetividade na manutenção de leilões ativos."
                  : "Baixo uso de bots. Considere implementar mais automação para manter engajamento."
                }
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <h4 className="font-semibold text-orange-800 mb-2">⚡ Performance</h4>
              <p className="text-sm text-orange-700">
                {bidEfficiency < 1 
                  ? "Eficiência de lances baixa. Revise estratégias de preços e mecânicas de leilão."
                  : bidEfficiency < 3
                  ? "Eficiência moderada. Oportunidade de otimizar custos de lances."
                  : "Excelente eficiência! Continue monitorando para manter performance."
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedAnalytics;