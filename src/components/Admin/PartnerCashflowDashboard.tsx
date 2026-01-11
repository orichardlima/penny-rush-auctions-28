import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Users,
  RefreshCw,
  Gift,
  Banknote,
  Receipt,
  Download,
  FileText
} from 'lucide-react';
import { usePartnerCashflow, ReferralBonusDetail, CashflowMovement } from '@/hooks/usePartnerCashflow';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Legend, ComposedChart, Line } from 'recharts';

const formatPrice = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
};

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'PAID': { label: 'Pago', variant: 'default' },
    'PENDING': { label: 'Pendente', variant: 'secondary' },
    'AVAILABLE': { label: 'Disponível', variant: 'outline' },
    'APPROVED': { label: 'Aprovado', variant: 'default' },
    'ACTIVE': { label: 'Ativo', variant: 'default' },
    'COMPLETED': { label: 'Concluído', variant: 'default' },
    'REJECTED': { label: 'Rejeitado', variant: 'destructive' },
    'BLOCKED': { label: 'Bloqueado', variant: 'destructive' }
  };
  
  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const chartConfig = {
  entradas: {
    label: "Entradas",
    color: "hsl(142, 76%, 36%)"
  },
  saidas: {
    label: "Saídas",
    color: "hsl(0, 84%, 60%)"
  },
  saldoAcumulado: {
    label: "Saldo Acumulado",
    color: "hsl(221, 83%, 53%)"
  }
};

export const PartnerCashflowDashboard: React.FC = () => {
  const { data, loading, refresh } = usePartnerCashflow();
  const [movementFilter, setMovementFilter] = useState<'all' | 'entrada' | 'saida'>('all');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Não foi possível carregar os dados do caixa.
        </CardContent>
      </Card>
    );
  }

  const { summary, weeklyFlow, referralBonuses, recentMovements } = data;

  const filteredMovements = recentMovements.filter(m => 
    movementFilter === 'all' || m.type === movementFilter
  );

  const exportToCSV = () => {
    const headers = ['Data', 'Tipo', 'Categoria', 'Parceiro', 'Descrição', 'Valor', 'Status'];
    const rows = recentMovements.map(m => [
      formatDate(m.date),
      m.type === 'entrada' ? 'Entrada' : 'Saída',
      m.category,
      m.partner_name,
      m.description,
      formatPrice(m.amount),
      m.status
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `caixa-parceiros-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Caixa Financeiro - Parceiros</h2>
          <p className="text-muted-foreground">Visão completa de entradas e saídas do módulo de parceiros</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              Total Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPrice(summary.totalEntradas)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.contractsCount} contratos + {summary.upgradesCount} upgrades
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              Total Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatPrice(summary.totalSaidas)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pendente: {formatPrice(summary.totalSaidasPending)}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${summary.saldoLiquido >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Saldo Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.saldoLiquido >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatPrice(summary.saldoLiquido)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Entradas - Saídas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gift className="h-4 w-4 text-purple-500" />
              Bônus Indicação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatPrice(summary.totalReferralBonusesPaid)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pendente: {formatPrice(summary.totalReferralBonusesPending)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entradas Box */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <TrendingUp className="h-5 w-5" />
              Caixa de Entradas
            </CardTitle>
            <CardDescription>Receitas provenientes dos parceiros</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-green-600" />
                <span>Aportes Iniciais</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-green-700 dark:text-green-400">{formatPrice(summary.totalAportes)}</span>
                <p className="text-xs text-muted-foreground">{summary.contractsCount} contratos</p>
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-green-600" />
                <span>Upgrades de Plano</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-green-700 dark:text-green-400">{formatPrice(summary.totalUpgrades)}</span>
                <p className="text-xs text-muted-foreground">{summary.upgradesCount} upgrades</p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t-2 border-green-300 dark:border-green-700">
              <span className="font-bold text-green-800 dark:text-green-300">TOTAL ENTRADAS</span>
              <span className="text-xl font-bold text-green-700 dark:text-green-400">{formatPrice(summary.totalEntradas)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Saídas Box */}
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <TrendingDown className="h-5 w-5" />
              Caixa de Saídas
            </CardTitle>
            <CardDescription>Pagamentos realizados aos parceiros</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-red-600" />
                <span>Repasses (Payouts)</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-red-700 dark:text-red-400">{formatPrice(summary.totalPayoutsPaid)}</span>
                <p className="text-xs text-muted-foreground">
                  {summary.payoutsCount} pagos | Pendente: {formatPrice(summary.totalPayoutsPending)}
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-red-600" />
                <span>Saques</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-red-700 dark:text-red-400">{formatPrice(summary.totalWithdrawalsPaid)}</span>
                <p className="text-xs text-muted-foreground">
                  {summary.withdrawalsCount} pagos | Pendente: {formatPrice(summary.totalWithdrawalsPending)}
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-red-600" />
                <span>Bônus Indicação</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-red-700 dark:text-red-400">{formatPrice(summary.totalReferralBonusesPaid)}</span>
                <p className="text-xs text-muted-foreground">
                  {summary.referralBonusesCount} pagos | Pendente: {formatPrice(summary.totalReferralBonusesPending)}
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t-2 border-red-300 dark:border-red-700">
              <span className="font-bold text-red-800 dark:text-red-300">TOTAL SAÍDAS</span>
              <span className="text-xl font-bold text-red-700 dark:text-red-400">{formatPrice(summary.totalSaidas)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Caixa Semanal</CardTitle>
          <CardDescription>Evolução de entradas e saídas nas últimas 12 semanas</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ComposedChart data={weeklyFlow}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="weekLabel" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                className="text-muted-foreground"
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => formatPrice(value)}
              />
              <Legend />
              <Bar 
                dataKey="entradas" 
                name="Entradas"
                fill="hsl(142, 76%, 36%)" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="saidas" 
                name="Saídas"
                fill="hsl(0, 84%, 60%)" 
                radius={[4, 4, 0, 0]}
              />
              <Line 
                type="monotone" 
                dataKey="saldoAcumulado" 
                name="Saldo Acumulado"
                stroke="hsl(221, 83%, 53%)" 
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Referral Bonuses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Bônus de Indicação
          </CardTitle>
          <CardDescription>Detalhamento dos bônus pagos por indicação de parceiros</CardDescription>
        </CardHeader>
        <CardContent>
          {referralBonuses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum bônus de indicação registrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="text-right">Aporte</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Bônus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referralBonuses.slice(0, 15).map((bonus) => (
                  <TableRow key={bonus.id}>
                    <TableCell className="font-medium">{bonus.referrer_name}</TableCell>
                    <TableCell>{bonus.referred_name}</TableCell>
                    <TableCell>{bonus.plan_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Nível {bonus.referral_level}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(bonus.aporte_value)}</TableCell>
                    <TableCell className="text-right">{bonus.bonus_percentage}%</TableCell>
                    <TableCell className="text-right font-semibold text-purple-600">
                      {formatPrice(bonus.bonus_value)}
                    </TableCell>
                    <TableCell>{getStatusBadge(bonus.status)}</TableCell>
                    <TableCell>{formatDate(bonus.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Movements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Movimentações Recentes
              </CardTitle>
              <CardDescription>Últimas 50 movimentações do caixa de parceiros</CardDescription>
            </div>
            <Select value={movementFilter} onValueChange={(v) => setMovementFilter(v as typeof movementFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entrada">Apenas Entradas</SelectItem>
                <SelectItem value="saida">Apenas Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>
                    {movement.type === 'entrada' ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        Entrada
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        <ArrowDownRight className="h-3 w-3 mr-1" />
                        Saída
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{movement.category}</TableCell>
                  <TableCell className="font-medium">{movement.partner_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{movement.description}</TableCell>
                  <TableCell className={`text-right font-semibold ${movement.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                    {movement.type === 'entrada' ? '+' : '-'}{formatPrice(movement.amount)}
                  </TableCell>
                  <TableCell>{getStatusBadge(movement.status)}</TableCell>
                  <TableCell>{formatDate(movement.date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
