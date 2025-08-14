import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingDown, Users, ShoppingCart, Target, Trophy } from 'lucide-react';

interface FinancialSummary {
  total_users?: number;
  paying_users?: number;
  total_bids?: number;
  user_bids?: number;
  conversion_rate?: number;
}

interface ConversionFunnelChartProps {
  summary?: FinancialSummary;
}

export const ConversionFunnelChart: React.FC<ConversionFunnelChartProps> = ({ summary }) => {
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de Conversão</CardTitle>
          <CardDescription>Carregando dados...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalUsers = summary.total_users || 0;
  const payingUsers = summary.paying_users || 0;
  const totalBids = summary.total_bids || 0;
  const userBids = summary.user_bids || 0;

  // Calcular métricas do funil
  const conversionToPurchase = totalUsers > 0 ? (payingUsers / totalUsers) * 100 : 0;
  const conversionToBidding = payingUsers > 0 ? ((userBids > 0 ? payingUsers : 0) / payingUsers) * 100 : 0;
  const bidEngagement = totalBids > 0 ? (userBids / totalBids) * 100 : 0;

  const funnelSteps = [
    {
      label: 'Usuários Totais',
      value: totalUsers,
      percentage: 100,
      icon: Users,
      color: 'bg-blue-500',
      description: 'Base total de usuários registrados'
    },
    {
      label: 'Usuários Pagantes',
      value: payingUsers,
      percentage: conversionToPurchase,
      icon: ShoppingCart,
      color: 'bg-green-500',
      description: 'Compraram pelo menos um pacote'
    },
    {
      label: 'Usuários Ativos em Lances',
      value: userBids > 0 ? Math.min(payingUsers, userBids) : 0,
      percentage: conversionToBidding,
      icon: Target,
      color: 'bg-purple-500',
      description: 'Realizaram lances em leilões'
    },
    {
      label: 'Engajamento Total',
      value: userBids,
      percentage: bidEngagement,
      icon: Trophy,
      color: 'bg-orange-500',
      description: 'Total de lances de usuários reais'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Funil de Conversão de Usuários
        </CardTitle>
        <CardDescription>
          Análise do comportamento dos usuários desde o registro até o engajamento ativo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {funnelSteps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === funnelSteps.length - 1;
            
            return (
              <div key={index} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${step.color} bg-opacity-20`}>
                      <Icon className={`h-4 w-4 text-${step.color.split('-')[1]}-600`} />
                    </div>
                    <div>
                      <h4 className="font-semibold">{step.label}</h4>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{step.value.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      {step.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="relative">
                  <Progress 
                    value={step.percentage} 
                    className="h-3"
                    style={{
                      background: `linear-gradient(to right, ${step.color.replace('bg-', 'rgb(')})`,
                    }}
                  />
                  <div 
                    className="absolute top-0 left-0 h-3 rounded-full transition-all"
                    style={{
                      width: `${step.percentage}%`,
                      background: step.color.includes('blue') ? '#3b82f6' :
                                 step.color.includes('green') ? '#10b981' :
                                 step.color.includes('purple') ? '#8b5cf6' :
                                 '#f59e0b'
                    }}
                  />
                </div>
                
                {!isLast && (
                  <div className="flex justify-center mt-4 mb-2">
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Summary Insights */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-2 text-sm">Insights do Funil:</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>• <strong>{conversionToPurchase.toFixed(1)}%</strong> dos usuários se tornam pagantes</p>
            <p>• <strong>{conversionToBidding.toFixed(1)}%</strong> dos pagantes se engajam ativamente</p>
            <p>• <strong>{bidEngagement.toFixed(1)}%</strong> dos lances são de usuários reais</p>
            <p>• Taxa de conversão geral: <strong>{summary.conversion_rate?.toFixed(1) || '0.0'}%</strong></p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};