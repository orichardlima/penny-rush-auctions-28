import { useState, useEffect } from 'react';
import { 
  Handshake, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Play, 
  Pause, 
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Calculator
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PartnerContract {
  id: string;
  user_id: string;
  aporte_value: number;
  monthly_cap: number;
  total_cap: number;
  total_received: number;
  status: string;
  plan_name: string;
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
  };
}

interface RevenueSnapshot {
  id: string;
  month: string;
  gross_revenue: number;
  partner_fund_percentage: number;
  partner_fund_value: number;
  is_closed: boolean;
  created_at: string;
}

export const AdminPartnerManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [contracts, setContracts] = useState<PartnerContract[]>([]);
  const [snapshots, setSnapshots] = useState<RevenueSnapshot[]>([]);
  const [stats, setStats] = useState({
    totalContracts: 0,
    activeContracts: 0,
    totalAportes: 0,
    totalDistributed: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch contracts with profile info
      const { data: contractsData, error: contractsError } = await supabase
        .from('partner_contracts')
        .select('*')
        .order('created_at', { ascending: false });

      if (contractsError) throw contractsError;

      // Fetch profiles for contracts
      const userIds = contractsData?.map(c => c.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const contractsWithProfiles = contractsData?.map(contract => ({
        ...contract,
        profile: profilesData?.find(p => p.user_id === contract.user_id)
      })) || [];

      setContracts(contractsWithProfiles);

      // Fetch revenue snapshots
      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('monthly_revenue_snapshots')
        .select('*')
        .order('month', { ascending: false })
        .limit(12);

      if (snapshotsError) throw snapshotsError;
      setSnapshots(snapshotsData || []);

      // Calculate stats
      const activeContracts = contractsData?.filter(c => c.status === 'ACTIVE') || [];
      setStats({
        totalContracts: contractsData?.length || 0,
        activeContracts: activeContracts.length,
        totalAportes: activeContracts.reduce((sum, c) => sum + Number(c.aporte_value), 0),
        totalDistributed: contractsData?.reduce((sum, c) => sum + Number(c.total_received), 0) || 0
      });

    } catch (error) {
      console.error('Error fetching partner data:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados de parceiros."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunPayoutCalculation = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-partner-payouts');
      
      if (error) throw error;

      if (data.success) {
        toast({
          title: "Cálculo executado",
          description: data.message
        });
        fetchData();
      } else {
        toast({
          variant: "destructive",
          title: "Erro no cálculo",
          description: data.message || "Falha ao calcular repasses"
        });
      }
    } catch (error: any) {
      console.error('Error running payout calculation:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Falha ao executar cálculo"
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateContractStatus = async (contractId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('partner_contracts')
        .update({ 
          status: newStatus,
          ...(newStatus === 'SUSPENDED' ? { closed_reason: 'Suspenso pelo administrador' } : {})
        })
        .eq('id', contractId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Contrato alterado para ${newStatus}`
      });
      fetchData();
    } catch (error) {
      console.error('Error updating contract:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o contrato"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-success/20 text-success border-success/30">Ativo</Badge>;
      case 'CLOSED':
        return <Badge className="bg-muted text-muted-foreground">Encerrado</Badge>;
      case 'SUSPENDED':
        return <Badge variant="destructive">Suspenso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Handshake className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Gestão de Parceiros</h2>
            <p className="text-muted-foreground">
              Administre contratos e repasses de participação em receita
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={handleRunPayoutCalculation} disabled={processing}>
            {processing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            Calcular Repasses
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total de Contratos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalContracts}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Contratos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{stats.activeContracts}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total em Aportes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalAportes)}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Total Distribuído
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrency(stats.totalDistributed)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contratos de Parceiros</CardTitle>
          <CardDescription>Lista de todos os contratos de participação em receita</CardDescription>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Handshake className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum contrato de parceiro encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Aporte</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Progresso</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => {
                  const progress = (Number(contract.total_received) / Number(contract.total_cap)) * 100;
                  return (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contract.profile?.full_name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{contract.profile?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{contract.plan_name}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(contract.aporte_value))}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatCurrency(Number(contract.total_received))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-12">
                            {progress.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(contract.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          {contract.status === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateContractStatus(contract.id, 'SUSPENDED')}
                              title="Suspender"
                            >
                              <Pause className="h-4 w-4 text-warning" />
                            </Button>
                          )}
                          {contract.status === 'SUSPENDED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateContractStatus(contract.id, 'ACTIVE')}
                              title="Reativar"
                            >
                              <Play className="h-4 w-4 text-success" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Revenue Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Fechamentos Mensais</CardTitle>
          <CardDescription>Snapshots de receita e distribuição do fundo de parceiros</CardDescription>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum fechamento mensal registrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Faturamento Bruto</TableHead>
                  <TableHead className="text-center">% Fundo</TableHead>
                  <TableHead className="text-right">Valor do Fundo</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell className="font-medium capitalize">
                      {format(new Date(snapshot.month), "MMMM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(snapshot.gross_revenue))}
                    </TableCell>
                    <TableCell className="text-center">
                      {snapshot.partner_fund_percentage}%
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(Number(snapshot.partner_fund_value))}
                    </TableCell>
                    <TableCell className="text-center">
                      {snapshot.is_closed ? (
                        <Badge className="bg-success/20 text-success border-success/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Fechado
                        </Badge>
                      ) : (
                        <Badge className="bg-warning/20 text-warning border-warning/30">
                          <Clock className="h-3 w-3 mr-1" />
                          Aberto
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Compliance Notice */}
      <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
        ⚠️ Este sistema não representa investimento financeiro. Os valores dependem do desempenho da plataforma.
      </div>
    </div>
  );
};
