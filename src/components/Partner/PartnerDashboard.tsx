import React from 'react';
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
  BanknoteIcon
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PartnerPlanCard } from './PartnerPlanCard';
import PartnerReferralSection from './PartnerReferralSection';
import PartnerEarlyTerminationDialog from './PartnerEarlyTerminationDialog';
import PartnerWithdrawalSection from './PartnerWithdrawalSection';

const PartnerDashboard = () => {
  const { 
    contract, 
    payouts, 
    plans, 
    loading, 
    submitting,
    createContract,
    getProgress,
    getLastPayout,
    refreshData 
  } = usePartnerContract();
  
  const { getSettingValue } = useSystemSettings();
  const { fetchPendingRequest } = usePartnerEarlyTermination();
  
  const weeklyPaymentDay = getSettingValue('partner_weekly_payment_day', 5);
  
  const getDayName = (day: number) => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[day] || 'Sexta-feira';
  };
  
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
    const totalPaid = payouts.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const totalPending = payouts.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
    return { totalPaid, totalPending, totalWeeks: payouts.length };
  }, [payouts]);

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
            <h3 className="font-semibold mb-4">Como funciona?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Participe</p>
                  <p className="text-muted-foreground">Escolha um plano e realize seu aporte contratual</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Acompanhe</p>
                  <p className="text-muted-foreground">Repasses proporcionais ao faturamento</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Encerramento automático</p>
                  <p className="text-muted-foreground">O contrato encerra ao atingir o teto</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Este programa não representa investimento financeiro ou promessa de rentabilidade. Os valores dependem exclusivamente do desempenho da plataforma. Não há garantia de retorno, valor mínimo ou prazo.
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Painel do Parceiro</h2>
          <p className="text-muted-foreground">Acompanhe sua participação e repasses</p>
        </div>
        <Button variant="outline" onClick={refreshData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

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
            Limite mensal: {formatPrice(contract.monthly_cap)} | Teto total: {formatPrice(contract.total_cap)}
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
          {/* Alerta do Dia de Pagamento */}
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              Os pagamentos são processados toda <strong>{getDayName(weeklyPaymentDay)}</strong>
            </AlertDescription>
          </Alert>

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
              <CardTitle className="flex items-center gap-2">
                <BanknoteIcon className="h-5 w-5" />
                Histórico Semanal
              </CardTitle>
              <CardDescription>Detalhes de cada repasse semanal</CardDescription>
            </CardHeader>
            <CardContent>
              {payouts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {payouts.map((payout) => {
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
                          
                          {(payout.monthly_cap_applied || payout.total_cap_applied) && (
                            <div className="flex gap-1 mt-2">
                              {payout.monthly_cap_applied && (
                                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                                  Limite mensal
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
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum repasse ainda</p>
                  <p className="text-sm">Os repasses são processados semanalmente</p>
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
          <PartnerReferralSection />
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