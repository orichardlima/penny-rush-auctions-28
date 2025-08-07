import React from 'react';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface RevenueData {
  date_period: string;
  auction_revenue: number;
  package_revenue: number;
  total_revenue: number;
  bids_count: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  loading?: boolean;
}

const chartConfig = {
  auction_revenue: {
    label: "Receita Leilões",
    color: "hsl(var(--primary))",
  },
  package_revenue: {
    label: "Receita Pacotes",
    color: "hsl(var(--secondary))",
  },
  total_revenue: {
    label: "Receita Total",
    color: "hsl(var(--accent))",
  },
};

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, loading = false }) => {
  const formatXAxis = (tickItem: string) => {
    return format(new Date(tickItem), 'dd/MM');
  };

  const formatTooltipLabel = (label: string) => {
    return format(new Date(label), 'dd/MM/yyyy');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução da Receita</CardTitle>
          <CardDescription>Últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse">Carregando gráfico...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução da Receita</CardTitle>
        <CardDescription>Últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date_period" 
              tickFormatter={formatXAxis}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
              stroke="hsl(var(--muted-foreground))"
            />
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  labelFormatter={formatTooltipLabel}
                  formatter={(value: number, name: string) => [
                    `R$ ${value.toFixed(2)}`,
                    chartConfig[name as keyof typeof chartConfig]?.label || name
                  ]}
                />
              }
            />
            <Line 
              type="monotone" 
              dataKey="auction_revenue" 
              stroke="var(--color-auction_revenue)"
              strokeWidth={2}
              dot={{ fill: "var(--color-auction_revenue)", strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="package_revenue" 
              stroke="var(--color-package_revenue)"
              strokeWidth={2}
              dot={{ fill: "var(--color-package_revenue)", strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="total_revenue" 
              stroke="var(--color-total_revenue)"
              strokeWidth={3}
              dot={{ fill: "var(--color-total_revenue)", strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};