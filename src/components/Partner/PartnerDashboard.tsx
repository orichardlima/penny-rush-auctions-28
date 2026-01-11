import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePartnerContract } from '@/hooks/usePartnerContract';
import { usePartnerEarlyTermination } from '@/hooks/usePartnerEarlyTermination';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { 
  Wallet, 
  TrendingUp, 
  Target, 
  Calendar, 
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  Users,
  CalendarDays,
  BanknoteIcon,
  Timer,
  Zap
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PartnerPlanCard } from './PartnerPlanCard';
import PartnerReferralSection from './PartnerReferralSection';
import PartnerEarlyTerminationDialog from './PartnerEarlyTerminationDialog';
import PartnerWithdrawalSection from './PartnerWithdrawalSection';
import PartnerUpgradeDialog from './PartnerUpgradeDialog';
import { PartnerBadge } from './PartnerBadge';
import { GraduationBadge } from './GraduationBadge';
import { usePartnerReferrals } from '@/hooks/usePartnerReferrals';
import { usePartnerLevels } from '@/hooks/usePartnerLevels';
import { FileText, GraduationCap } from 'lucide-react';

const PartnerDashboard = () => {
  const { 
    contract, 
    payouts, 
    plans, 
    loading, 
    submitting,
    createContract,
    upgradeContract,
    getProgress,
    getLastPayout,
    canUpgrade,
    refreshData 
  } = usePartnerContract();
  
  const { getSettingValue } = useSystemSettings();
  const { fetchPendingRequest } = usePartnerEarlyTermination();
  const { totalPoints, loading: referralLoading } = usePartnerReferrals();
  const { getCurrentLevel, getProgress: getLevelProgress } = usePartnerLevels(totalPoints);
  
  const weeklyPaymentDay = getSettingValue('partner_weekly_payment_day', 5);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const getDayName = (day: number) => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[day] || 'Sexta-feira';
  };

  // Calculate next payment day
  const getNextPaymentInfo = React.useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    let daysUntil = weeklyPaymentDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    
    const nextPaymentDate = new Date(today);
    nextPaymentDate.setDate(today.getDate() + daysUntil);
    
    return {
      date: nextPaymentDate,
      daysUntil,
      formatted: nextPaymentDate.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        day: '2-digit', 
        month: '2-digit' 
      })
    };
  }, [weeklyPaymentDay]);

  // Get current week period (Monday to Sunday)
  const getCurrentWeekPeriod = React.useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      start: monday,
      end: sunday,
      formatted: `${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    };
  }, []);
  
  React.useEffect(() => {
    if (contract?.id) {
      fetchPendingRequest(contract.id);
    }
  }, [contract?.id, fetchPendingRequest]);
  
  // Prepare chart data from payouts
  const chartData = React.useMemo(() => {
    return payouts
      .slice(0, 10)
      .reverse()
      .map((p) => {
        const start = new Date(p.period_start);
        return {
          semana: `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
          valor: p.amount,
          status: p.status
        };
      });
  }, [payouts]);
  
  // Calculate totals for summary
  const payoutTotals = React.useMemo(() => {
    const paidPayouts = payouts.filter(p => p.status === 'PAID');
    const totalPaid = paidPayouts.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = payouts.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
    const averagePayout = paidPayouts.length > 0 ? totalPaid / paidPayouts.length : 0;
    return { totalPaid, totalPending, totalWeeks: payouts.length, averagePayout, paidCount: paidPayouts.length, pendingCount: payouts.filter(p => p.status === 'PENDING').length };
  }, [payouts]);

  // Filter payouts based on status
  const filteredPayouts = React.useMemo(() => {
    if (statusFilter === 'all') return payouts;
    return payouts.filter(p => p.status === statusFilter);
  }, [payouts, statusFilter]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatPeriod = (periodStart: string, periodEnd?: string | null) => {
    const start = new Date(periodStart);
    const end = periodEnd ? new Date(periodEnd) : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${formatDate(start)} - ${formatDate(end)}/${start.getFullYear()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
      case 'CLOSED':
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Encerrado</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Suspenso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPayoutStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pendente</Badge>;
      case 'PAID':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Pago</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não tem contrato, mostrar planos disponíveis
  if (!contract) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Torne-se um Parceiro</h2>
          <p className="text-muted-foreground">
            Escolha um plano de participação e participe de repasses semanais, proporcionais ao faturamento da plataforma
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <PartnerPlanCard
              key={plan.id}
              plan={plan}
              onSelect={createContract}
              loading={submitting}
            />
          ))}
        </div>

        <Card className="bg-muted/50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Como funciona o modelo?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Seu Aporte</p>
                  <p className="text-muted-foreground">Contribui para operação e crescimento da plataforma</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Origem dos Repasses</p>
                  <p className="text-muted-foreground">Parcela do faturamento real da plataforma</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/10 rounded-full">
                  <Target className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium">Limites Claros</p>
                  <p className="text-muted-foreground">Teto e limite semanal definidos em contrato</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Os repasses são proporcionais ao desempenho da plataforma. Não há garantia de valor mínimo ou prazo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = getProgress();
  const lastPayout = getLastPayout();

  // Extend contract with pix fields for WithdrawalSection
  const contractWithPix = contract as typeof contract & {
    pix_key?: string | null;
    pix_key_type?: string | null;
    bank_details?: any;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold mb-1">Painel do Parceiro</h2>
            <p className="text-muted-foreground">Acompanhe sua participação e repasses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canUpgrade() && (
            <PartnerUpgradeDialog
              contract={contract}
              plans={plans}
              onUpgrade={upgradeContract}
              submitting={submitting}
            />
          )}
          <Button variant="outline" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Card de Resumo: Plano + Graduação */}
      <Card className="bg-gradient-to-r from-muted/50 to-muted/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plano Contratado */}
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-background">
              <div className="p-3 bg-amber-500/10 rounded-full">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Plano Contratado</p>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <PartnerBadge planName={contract.plan_name} size="md" />
                  {(contract as any).bonus_bids_received > 0 && (
                    <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-500/30">
                      <Zap className="h-3 w-3" />
                      +{(contract as any).bonus_bids_received} lances
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>Aporte: <span className="font-medium text-foreground">{formatPrice(contract.aporte_value)}</span></p>
                  <p>Teto: <span className="font-medium text-foreground">{formatPrice(contract.total_cap)}</span></p>
                </div>
              </div>
            </div>

            {/* Graduação */}
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-background">
              <div className="p-3 bg-purple-500/10 rounded-full">
                <GraduationCap className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Sua Graduação</p>
                <div className="flex items-center gap-2 mb-2">
                  <GraduationBadge totalPoints={totalPoints} size="md" showPoints={false} />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p><span className="font-medium text-foreground">{totalPoints}</span> pontos acumulados</p>
                  {getLevelProgress().nextLevel && (
                    <p className="mt-1">
                      <span className="font-medium text-primary">
                        {getLevelProgress().pointsToNextLevel} pts
                      </span> para {getLevelProgress().nextLevel?.display_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            ℹ️ O <strong>plano</strong> define seu aporte e teto. A <strong>graduação</strong> aumenta com indicações e dá bônus extras.
          </p>
        </CardContent>
      </Card>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Aportado</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(contract.aporte_value)}</div>
            <p className="text-xs text-muted-foreground">Plano {contract.plan_name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPrice(contract.total_received)}</div>
            <p className="text-xs text-muted-foreground">
              {((contract.total_received / contract.aporte_value) * 100).toFixed(1)}% do aporte
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falta para o Teto</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(progress.remaining)}</div>
            <p className="text-xs text-muted-foreground">de {formatPrice(contract.total_cap)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {contract.status === 'ACTIVE' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : contract.status === 'SUSPENDED' ? (
              <AlertCircle className="h-4 w-4 text-red-600" />
            ) : (
              <Clock className="h-4 w-4 text-gray-600" />
            )}
          </CardHeader>
          <CardContent>
            {getStatusBadge(contract.status)}
            <p className="text-xs text-muted-foreground mt-1">
              Desde {formatDate(contract.created_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progresso do Contrato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Progresso até o Teto
          </CardTitle>
          <CardDescription>
            Limite semanal: {formatPrice(contract.weekly_cap)} | Teto total: {formatPrice(contract.total_cap)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress.percentage} className="h-4" />
          <div className="flex justify-between text-sm">
            <span>{formatPrice(contract.total_received)} recebido</span>
            <span className="font-medium">{progress.percentage.toFixed(1)}%</span>
            <span>{formatPrice(contract.total_cap)} teto</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Conteúdo */}
      <Tabs defaultValue="payouts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Repasses
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Saques
          </TabsTrigger>
          <TabsTrigger value="referrals" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Indicações
          </TabsTrigger>
        </TabsList>

        {/* Tab de Repasses */}
        <TabsContent value="payouts" className="space-y-4">
          {/* Card de Próximo Repasse */}
          <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/20 rounded-full">
                    <CalendarDays className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Próximo Repasse</p>
                    <p className="text-lg font-bold capitalize">{getNextPaymentInfo.formatted}</p>
                    <p className="text-xs text-muted-foreground">
                      Faltam <strong>{getNextPaymentInfo.daysUntil}</strong> {getNextPaymentInfo.daysUntil === 1 ? 'dia' : 'dias'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Previsão (média)</p>
                  <p className="text-xl font-semibold text-purple-600">
                    {payoutTotals.averagePayout > 0 ? formatPrice(payoutTotals.averagePayout) : 'Aguardando dados'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card de Semana Atual em Andamento */}
          <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Timer className="h-5 w-5 text-primary animate-pulse" />
                  </div>
                  <div>
                    <p className="font-medium">Semana em Andamento</p>
                    <p className="text-sm text-muted-foreground">
                      {getCurrentWeekPeriod.formatted}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Contabilizando...
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                O repasse desta semana será processado na próxima <strong>{getDayName(weeklyPaymentDay)}</strong>.
              </p>
            </CardContent>
          </Card>

          {/* Card de Resumo */}
          <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="grid grid-cols-3 gap-4 p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total de Semanas</p>
                <p className="text-2xl font-bold">{payoutTotals.totalWeeks}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Pago</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(payoutTotals.totalPaid)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-2xl font-bold text-yellow-600">{formatPrice(payoutTotals.totalPending)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Evolução */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Evolução dos Ganhos Semanais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip 
                      formatter={(value: number) => [formatPrice(value), 'Valor']}
                      labelFormatter={(label) => `Semana de ${label}`}
                    />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.status === 'PAID' ? '#22c55e' : entry.status === 'PENDING' ? '#eab308' : '#6b7280'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> Pago</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500"></span> Pendente</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico de Repasses em Cards */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BanknoteIcon className="h-5 w-5" />
                    Histórico Semanal
                  </CardTitle>
                  <CardDescription>Detalhes de cada repasse semanal</CardDescription>
                </div>
                {payouts.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant={statusFilter === 'all' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setStatusFilter('all')}
                    >
                      Todos ({payoutTotals.totalWeeks})
                    </Button>
                    <Button 
                      variant={statusFilter === 'PAID' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setStatusFilter('PAID')}
                    >
                      Pagos ({payoutTotals.paidCount})
                    </Button>
                    <Button 
                      variant={statusFilter === 'PENDING' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setStatusFilter('PENDING')}
                    >
                      Pendentes ({payoutTotals.pendingCount})
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {payouts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPayouts.map((payout) => {
                    const start = new Date(payout.period_start);
                    const end = payout.period_end ? new Date(payout.period_end) : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
                    const isPaid = payout.status === 'PAID';
                    const isPending = payout.status === 'PENDING';
                    
                    return (
                      <Card 
                        key={payout.id} 
                        className={`border-l-4 ${isPaid ? 'border-l-green-500 bg-green-500/5' : isPending ? 'border-l-yellow-500 bg-yellow-500/5' : 'border-l-gray-500 bg-gray-500/5'}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - {end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </span>
                            </div>
                            {getPayoutStatusBadge(payout.status)}
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Valor Calculado:</span>
                              <span>{formatPrice(payout.calculated_amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium">
                              <span className="text-muted-foreground">Valor Recebido:</span>
                              <span className={isPaid ? 'text-green-600' : isPending ? 'text-yellow-600' : ''}>
                                {formatPrice(payout.amount)}
                              </span>
                            </div>
                          </div>
                          
                          {(payout.weekly_cap_applied || payout.total_cap_applied) && (
                            <div className="flex gap-1 mt-2">
                              {payout.weekly_cap_applied && (
                                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                                  Limite semanal
                                </Badge>
                              )}
                              {payout.total_cap_applied && (
                                <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-500/30">
                                  Limite teto
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          {isPaid && payout.paid_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Pago em {new Date(payout.paid_at).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Explicação Visual do Ciclo */}
                  <Card className="bg-muted/30">
                    <CardContent className="p-6">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-500" />
                        Como funciona o ciclo de repasses?
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-background rounded-lg">
                          <div className="p-2 bg-blue-500/10 rounded-full inline-flex mb-2">
                            <Calendar className="h-5 w-5 text-blue-500" />
                          </div>
                          <p className="text-sm font-medium">Segunda-feira</p>
                          <p className="text-xs text-muted-foreground">Início do período</p>
                        </div>
                        <div className="text-center p-3 bg-background rounded-lg">
                          <div className="p-2 bg-purple-500/10 rounded-full inline-flex mb-2">
                            <TrendingUp className="h-5 w-5 text-purple-500" />
                          </div>
                          <p className="text-sm font-medium">Durante a Semana</p>
                          <p className="text-xs text-muted-foreground">Faturamento contabilizado</p>
                        </div>
                        <div className="text-center p-3 bg-background rounded-lg">
                          <div className="p-2 bg-orange-500/10 rounded-full inline-flex mb-2">
                            <Target className="h-5 w-5 text-orange-500" />
                          </div>
                          <p className="text-sm font-medium">Domingo</p>
                          <p className="text-xs text-muted-foreground">Fechamento do período</p>
                        </div>
                        <div className="text-center p-3 bg-background rounded-lg">
                          <div className="p-2 bg-green-500/10 rounded-full inline-flex mb-2">
                            <DollarSign className="h-5 w-5 text-green-500" />
                          </div>
                          <p className="text-sm font-medium">{getDayName(weeklyPaymentDay)}</p>
                          <p className="text-xs text-muted-foreground">Processamento do repasse</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum repasse processado ainda</p>
                    <p className="text-sm">Seu primeiro repasse será creditado na próxima {getDayName(weeklyPaymentDay)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Saques */}
        <TabsContent value="withdrawals">
          <PartnerWithdrawalSection contract={contractWithPix} onRefresh={refreshData} />
        </TabsContent>

        {/* Tab de Indicações */}
        <TabsContent value="referrals">
          <PartnerReferralSection planName={contract.plan_name} />
        </TabsContent>
      </Tabs>

      {/* Encerramento Antecipado */}
      {contract.status === 'ACTIVE' && (
        <Card className="border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-lg">Opções do Contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PartnerEarlyTerminationDialog 
              contract={contract} 
              onSuccess={refreshData}
            />
            <p className="text-xs text-muted-foreground">
              O encerramento antecipado é uma liquidação condicionada, sujeita à liquidez da plataforma.
              Não representa devolução garantida do aporte.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Aviso Legal */}
      <Alert className="border-yellow-500/20 bg-yellow-500/5">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-sm text-yellow-700">
          Os valores dependem exclusivamente do desempenho da plataforma. 
          Não há garantia de retorno, valor mínimo ou prazo.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default PartnerDashboard;