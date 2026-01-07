import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { usePartnerContract } from '@/hooks/usePartnerContract';
import { 
  Wallet, 
  TrendingUp, 
  Target, 
  Calendar, 
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { PartnerPlanCard } from './PartnerPlanCard';

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

  const formatMonth = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
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
            Escolha um plano de participação e receba repasses mensais proporcionais ao faturamento da plataforma
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
                  <p className="text-muted-foreground">Escolha um plano e faça seu aporte</p>
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
              Este programa não representa investimento financeiro. Os valores dependem do desempenho da plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = getProgress();
  const lastPayout = getLastPayout();

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

      {/* Último Repasse */}
      {lastPayout && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Último Repasse - {formatMonth(lastPayout.month)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{formatPrice(lastPayout.amount)}</p>
                {lastPayout.monthly_cap_applied && (
                  <p className="text-xs text-yellow-600">Limite mensal aplicado</p>
                )}
                {lastPayout.total_cap_applied && (
                  <p className="text-xs text-orange-600">Limite de teto aplicado</p>
                )}
              </div>
              {getPayoutStatusBadge(lastPayout.status)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Repasses */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Repasses</CardTitle>
          <CardDescription>Todos os repasses recebidos</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Valor Calculado</TableHead>
                  <TableHead>Valor Recebido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">{formatMonth(payout.month)}</TableCell>
                    <TableCell>{formatPrice(payout.calculated_amount)}</TableCell>
                    <TableCell className="font-medium">{formatPrice(payout.amount)}</TableCell>
                    <TableCell>{getPayoutStatusBadge(payout.status)}</TableCell>
                    <TableCell>
                      {payout.monthly_cap_applied && (
                        <Badge variant="outline" className="text-xs mr-1">Limite mensal</Badge>
                      )}
                      {payout.total_cap_applied && (
                        <Badge variant="outline" className="text-xs">Limite teto</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum repasse ainda</p>
              <p className="text-sm">Os repasses são processados mensalmente</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerDashboard;