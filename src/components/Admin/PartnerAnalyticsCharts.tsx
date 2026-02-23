import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { TrendingUp, PieChartIcon, DollarSign, Users } from 'lucide-react';
import { WeeklyRevenueSnapshot, PartnerPayoutWithContract, PartnerContractWithUser, PartnerPlan, formatWeekRange } from '@/hooks/useAdminPartners';

interface PartnerAnalyticsChartsProps {
  snapshots: WeeklyRevenueSnapshot[];
  payouts: PartnerPayoutWithContract[];
  contracts: PartnerContractWithUser[];
  plans: PartnerPlan[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const PartnerAnalyticsCharts: React.FC<PartnerAnalyticsChartsProps> = ({
  snapshots,
  payouts,
  contracts,
  plans
}) => {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPeriod = (periodStart: string, periodEnd?: string | null) => {
    return formatWeekRange(periodStart, periodEnd);
  };

  // Data for Weekly Fund Evolution (last 12 weeks)
  const weeklyFundData = snapshots
    .slice(0, 12)
    .reverse()
    .map(s => ({
      period: formatPeriod(s.period_start, s.period_end),
      faturamento: s.gross_revenue,
      fundo: s.partner_fund_value,
      percentual: s.partner_fund_percentage
    }));

  // Data for Plan Distribution
  const planDistributionData = plans.map(plan => {
    const contractsInPlan = contracts.filter(c => c.plan_name === plan.name && c.status === 'ACTIVE');
    const totalAporte = contractsInPlan.reduce((sum, c) => sum + c.aporte_value, 0);
    return {
      name: plan.display_name,
      value: contractsInPlan.length,
      aporte: totalAporte
    };
  }).filter(p => p.value > 0);

  // Data for Accumulated Payouts (last 12 weeks)
  const accumulatedPayoutsData = snapshots
    .slice(0, 12)
    .reverse()
    .map((s, index, arr) => {
      const periodPayouts = payouts.filter(p => p.period_start === s.period_start && p.status === 'PAID');
      const creditedAmount = periodPayouts.reduce((sum, p) => sum + p.amount, 0);
      
      // Calculate accumulated
      const previousCredited = arr.slice(0, index).reduce((sum, prev) => {
        const prevPayouts = payouts.filter(p => p.period_start === prev.period_start && p.status === 'PAID');
        return sum + prevPayouts.reduce((s, p) => s + p.amount, 0);
      }, 0);
      
      return {
        period: formatPeriod(s.period_start, s.period_end),
        creditado: creditedAmount,
        acumulado: previousCredited + creditedAmount
      };
    });

  // Summary metrics
  const totalCreditedAllTime = payouts.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const averageMonthlyPayout = snapshots.length > 0 
    ? snapshots.reduce((sum, s) => sum + s.partner_fund_value, 0) / snapshots.length 
    : 0;
  const activeContractsCount = contracts.filter(c => c.status === 'ACTIVE').length;

  const chartConfig = {
    faturamento: { label: 'Faturamento', color: 'hsl(var(--muted-foreground))' },
    fundo: { label: 'Fundo Parceiros', color: 'hsl(var(--primary))' },
    creditado: { label: 'Creditado', color: 'hsl(var(--primary))' },
    acumulado: { label: 'Acumulado', color: 'hsl(var(--chart-3))' },
    period: { label: 'Período', color: 'hsl(var(--primary))' },
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Creditado</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPrice(totalCreditedAllTime)}</div>
            <p className="text-xs text-muted-foreground">Em todos os repasses</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(averageMonthlyPayout)}</div>
            <p className="text-xs text-muted-foreground">Fundo de parceiros</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeContractsCount}</div>
            <p className="text-xs text-muted-foreground">Parceiros ativos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Fund Evolution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Evolução Semanal do Fundo</CardTitle>
            </div>
            <CardDescription>Faturamento bruto vs Fundo de parceiros</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyFundData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyFundData}>
                    <XAxis dataKey="period" fontSize={10} angle={-45} textAnchor="end" height={60} />
                    <YAxis fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatPrice(value)}
                    />
                    <Bar dataKey="faturamento" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Faturamento" />
                    <Bar dataKey="fundo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Fundo Parceiros" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              <CardTitle>Distribuição por Plano</CardTitle>
            </div>
            <CardDescription>Contratos ativos por plano</CardDescription>
          </CardHeader>
          <CardContent>
            {planDistributionData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {planDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">{data.name}</p>
                              <p className="text-sm text-muted-foreground">{data.value} contratos</p>
                              <p className="text-sm text-muted-foreground">Total: {formatPrice(data.aporte)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum contrato ativo
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accumulated Payouts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Repasses por Semana</CardTitle>
          </div>
          <CardDescription>Valores pagos e pendentes por semana</CardDescription>
        </CardHeader>
        <CardContent>
          {accumulatedPayoutsData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={accumulatedPayoutsData}>
                  <XAxis dataKey="period" fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => formatPrice(value)}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="creditado" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.6}
                    name="Creditado"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum repasse processado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerAnalyticsCharts;
