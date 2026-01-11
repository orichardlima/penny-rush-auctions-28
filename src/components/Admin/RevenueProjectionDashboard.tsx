import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Legend, ComposedChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Users, RefreshCw, Calendar } from 'lucide-react';
import { useRevenueProjections } from '@/hooks/useRevenueProjections';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const formatPrice = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPriceCompact = (value: number) => {
  if (value >= 1000) {
    return `R$${(value / 1000).toFixed(0)}k`;
  }
  return `R$${value.toFixed(0)}`;
};

export const RevenueProjectionDashboard: React.FC = () => {
  const [weeksToProject, setWeeksToProject] = useState(8);
  const { projections, summary, loading, error, refreshData } = useRevenueProjections(weeksToProject);

  const chartConfig = {
    bidRevenue: { label: 'Receita Lances', color: 'hsl(var(--primary))' },
    partnerRevenue: { label: 'Receita Parceiros', color: 'hsl(var(--chart-2))' },
    totalRevenue: { label: 'Receita Total', color: 'hsl(var(--chart-3))' },
    projectedPayouts: { label: 'Repasses Projetados', color: 'hsl(var(--chart-4))' },
    netRevenue: { label: 'Receita Líquida', color: 'hsl(var(--chart-5))' },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <p className="text-destructive">{error}</p>
            <Button onClick={refreshData} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Projeção de Receitas e Repasses</h2>
          <p className="text-muted-foreground">
            Baseado no desempenho histórico das últimas 12 semanas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={weeksToProject.toString()} onValueChange={(v) => setWeeksToProject(parseInt(v))}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">Próximas 4 semanas</SelectItem>
              <SelectItem value="8">Próximas 8 semanas</SelectItem>
              <SelectItem value="12">Próximas 12 semanas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={refreshData} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Lances (Projetada)</CardTitle>
              <CreditCard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatPrice(summary.totalBidRevenue)}</div>
              <div className="flex items-center gap-1 text-xs">
                {summary.growthRateBids >= 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">+{summary.growthRateBids.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 text-red-600" />
                    <span className="text-red-600">{summary.growthRateBids.toFixed(1)}%</span>
                  </>
                )}
                <span className="text-muted-foreground ml-1">vs período anterior</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Média: {formatPrice(summary.avgWeeklyBidRevenue)}/semana
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border-chart-2/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Parceiros (Projetada)</CardTitle>
              <Users className="h-4 w-4 text-[hsl(var(--chart-2))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--chart-2))]">{formatPrice(summary.totalPartnerRevenue)}</div>
              <div className="flex items-center gap-1 text-xs">
                {summary.growthRatePartners >= 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">+{summary.growthRatePartners.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 text-red-600" />
                    <span className="text-red-600">{summary.growthRatePartners.toFixed(1)}%</span>
                  </>
                )}
                <span className="text-muted-foreground ml-1">vs período anterior</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Média: {formatPrice(summary.avgWeeklyPartnerRevenue)}/semana
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-chart-4/10 to-chart-4/5 border-chart-4/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Repasses Projetados</CardTitle>
              <DollarSign className="h-4 w-4 text-[hsl(var(--chart-4))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--chart-4))]">{formatPrice(summary.totalProjectedPayouts)}</div>
              <p className="text-xs text-muted-foreground">
                Para as próximas {weeksToProject} semanas
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Média: {formatPrice(summary.avgWeeklyPayouts)}/semana
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-chart-5/10 to-chart-5/5 border-chart-5/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Líquida Projetada</CardTitle>
              <TrendingUp className="h-4 w-4 text-[hsl(var(--chart-5))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--chart-5))]">
                {formatPrice(summary.totalBidRevenue + summary.totalPartnerRevenue - summary.totalProjectedPayouts)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total - Repasses
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {((1 - summary.totalProjectedPayouts / (summary.totalBidRevenue + summary.totalPartnerRevenue)) * 100).toFixed(1)}% de margem
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Charts - Two Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Box 1: Receita de Lances */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Receita de Venda de Lances</CardTitle>
            </div>
            <CardDescription>
              Projeção baseada em compras de pacotes de lances
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projections.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projections}>
                    <XAxis 
                      dataKey="weekLabel" 
                      fontSize={10} 
                      angle={-45} 
                      textAnchor="end" 
                      height={70} 
                    />
                    <YAxis 
                      fontSize={12} 
                      tickFormatter={formatPriceCompact}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatPrice(value)}
                    />
                    <Bar 
                      dataKey="bidRevenue" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                      name="Receita Lances"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="bidRevenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                      name="Tendência"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados históricos disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        {/* Box 2: Receita de Parceiros */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[hsl(var(--chart-2))]" />
              <CardTitle>Receita de Planos de Parceiros</CardTitle>
            </div>
            <CardDescription>
              Projeção baseada em novos contratos de parceria
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projections.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projections}>
                    <XAxis 
                      dataKey="weekLabel" 
                      fontSize={10} 
                      angle={-45} 
                      textAnchor="end" 
                      height={70} 
                    />
                    <YAxis 
                      fontSize={12} 
                      tickFormatter={formatPriceCompact}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatPrice(value)}
                    />
                    <Bar 
                      dataKey="partnerRevenue" 
                      fill="hsl(var(--chart-2))" 
                      radius={[4, 4, 0, 0]} 
                      name="Receita Parceiros"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="partnerRevenue" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                      name="Tendência"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados históricos disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Combined Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Projeção Combinada de Receitas vs Repasses</CardTitle>
          </div>
          <CardDescription>
            Visão consolidada de todas as receitas e repasses projetados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projections.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projections}>
                  <XAxis 
                    dataKey="weekLabel" 
                    fontSize={10} 
                    angle={-45} 
                    textAnchor="end" 
                    height={70} 
                  />
                  <YAxis 
                    fontSize={12} 
                    tickFormatter={formatPriceCompact}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => formatPrice(value)}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="bidRevenue" 
                    stackId="1"
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.6}
                    name="Receita Lances"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="partnerRevenue" 
                    stackId="1"
                    stroke="hsl(var(--chart-2))" 
                    fill="hsl(var(--chart-2))" 
                    fillOpacity={0.6}
                    name="Receita Parceiros"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="projectedPayouts" 
                    stroke="hsl(var(--chart-4))" 
                    fill="hsl(var(--chart-4))" 
                    fillOpacity={0.3}
                    name="Repasses Projetados"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              Sem dados históricos disponíveis
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento Semanal</CardTitle>
          <CardDescription>Projeção detalhada para cada semana</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Semana</th>
                  <th className="text-right py-2 px-3">Lances</th>
                  <th className="text-right py-2 px-3">Parceiros</th>
                  <th className="text-right py-2 px-3">Total</th>
                  <th className="text-right py-2 px-3">Repasses</th>
                  <th className="text-right py-2 px-3">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {projections.map((projection, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{projection.weekLabel}</td>
                    <td className="text-right py-2 px-3 text-primary">{formatPrice(projection.bidRevenue)}</td>
                    <td className="text-right py-2 px-3 text-[hsl(var(--chart-2))]">{formatPrice(projection.partnerRevenue)}</td>
                    <td className="text-right py-2 px-3 font-medium">{formatPrice(projection.totalRevenue)}</td>
                    <td className="text-right py-2 px-3 text-[hsl(var(--chart-4))]">{formatPrice(projection.projectedPayouts)}</td>
                    <td className="text-right py-2 px-3 font-bold text-[hsl(var(--chart-5))]">{formatPrice(projection.netRevenue)}</td>
                  </tr>
                ))}
              </tbody>
              {summary && (
                <tfoot className="bg-muted/30">
                  <tr className="font-bold">
                    <td className="py-3 px-3">TOTAL</td>
                    <td className="text-right py-3 px-3 text-primary">{formatPrice(summary.totalBidRevenue)}</td>
                    <td className="text-right py-3 px-3 text-[hsl(var(--chart-2))]">{formatPrice(summary.totalPartnerRevenue)}</td>
                    <td className="text-right py-3 px-3">{formatPrice(summary.totalBidRevenue + summary.totalPartnerRevenue)}</td>
                    <td className="text-right py-3 px-3 text-[hsl(var(--chart-4))]">{formatPrice(summary.totalProjectedPayouts)}</td>
                    <td className="text-right py-3 px-3 text-[hsl(var(--chart-5))]">
                      {formatPrice(summary.totalBidRevenue + summary.totalPartnerRevenue - summary.totalProjectedPayouts)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueProjectionDashboard;
