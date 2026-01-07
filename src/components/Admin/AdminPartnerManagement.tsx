import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminPartners } from '@/hooks/useAdminPartners';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Edit,
  AlertTriangle,
  Wallet,
  Calendar
} from 'lucide-react';

const AdminPartnerManagement = () => {
  const { 
    contracts, 
    plans, 
    payouts, 
    snapshots,
    stats,
    loading, 
    processing,
    updateContractStatus,
    updatePlan,
    processMonthlyPayouts,
    markPayoutAsPaid,
    refreshData 
  } = useAdminPartners();

  const { getSettingValue, updateSetting } = useSystemSettings();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [fundPercentage, setFundPercentage] = useState(getSettingValue('partner_fund_percentage', 20));
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
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

  const handleProcessPayouts = async () => {
    if (!selectedMonth) return;
    await processMonthlyPayouts(selectedMonth, fundPercentage);
  };

  const handleSaveFundPercentage = async () => {
    await updateSetting('partner_fund_percentage', fundPercentage.toString());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Parceiros</h2>
          <p className="text-muted-foreground">Controle de contratos, planos e repasses</p>
        </div>
        <Button variant="outline" onClick={refreshData} disabled={processing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Totais</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContracts}</div>
            <p className="text-xs text-muted-foreground">{stats.activeContracts} ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total em Aportes</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(stats.totalAportes)}</div>
            <p className="text-xs text-muted-foreground">Contratos ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPrice(stats.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">Em repasses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repasses Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingPayouts}</div>
            <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fundo de Parceiros</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fundPercentage}%</div>
            <p className="text-xs text-muted-foreground">do faturamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contracts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="payouts">Repasses</TabsTrigger>
          <TabsTrigger value="process">Processar Mês</TabsTrigger>
        </TabsList>

        {/* Contratos Tab */}
        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Todos os Contratos</CardTitle>
              <CardDescription>Lista de todos os contratos de parceiros</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Aporte</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead>Teto</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => {
                    const progress = (contract.total_received / contract.total_cap) * 100;
                    return (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{contract.user_name}</p>
                            <p className="text-xs text-muted-foreground">{contract.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{contract.plan_name}</TableCell>
                        <TableCell>{formatPrice(contract.aporte_value)}</TableCell>
                        <TableCell className="text-green-600 font-medium">{formatPrice(contract.total_received)}</TableCell>
                        <TableCell>{formatPrice(contract.total_cap)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs">{progress.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(contract.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {contract.status === 'ACTIVE' && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Suspender Contrato</DialogTitle>
                                    <DialogDescription>
                                      Informe o motivo da suspensão
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label>Motivo</Label>
                                      <Input 
                                        value={suspendReason}
                                        onChange={(e) => setSuspendReason(e.target.value)}
                                        placeholder="Ex: Fraude detectada"
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button 
                                      variant="destructive"
                                      onClick={() => {
                                        updateContractStatus(contract.id, 'SUSPENDED', suspendReason);
                                        setSuspendReason('');
                                      }}
                                      disabled={processing}
                                    >
                                      Suspender
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                            {contract.status === 'SUSPENDED' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => updateContractStatus(contract.id, 'ACTIVE')}
                                disabled={processing}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {contracts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum contrato encontrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Planos Tab */}
        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Planos de Participação</CardTitle>
              <CardDescription>Configure os planos disponíveis</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Aporte</TableHead>
                    <TableHead>Limite Mensal</TableHead>
                    <TableHead>Teto Total</TableHead>
                    <TableHead>Retorno</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.display_name}</TableCell>
                      <TableCell>{formatPrice(plan.aporte_value)}</TableCell>
                      <TableCell>{formatPrice(plan.monthly_cap)}</TableCell>
                      <TableCell>{formatPrice(plan.total_cap)}</TableCell>
                      <TableCell className="text-green-600">
                        {((plan.total_cap / plan.aporte_value) * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                          {plan.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingPlan({ ...plan })}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Plano</DialogTitle>
                            </DialogHeader>
                            {editingPlan && (
                              <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Nome de Exibição</Label>
                                    <Input 
                                      value={editingPlan.display_name}
                                      onChange={(e) => setEditingPlan({...editingPlan, display_name: e.target.value})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Valor do Aporte (R$)</Label>
                                    <Input 
                                      type="number"
                                      value={editingPlan.aporte_value}
                                      onChange={(e) => setEditingPlan({...editingPlan, aporte_value: Number(e.target.value)})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Limite Mensal (R$)</Label>
                                    <Input 
                                      type="number"
                                      value={editingPlan.monthly_cap}
                                      onChange={(e) => setEditingPlan({...editingPlan, monthly_cap: Number(e.target.value)})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Teto Total (R$)</Label>
                                    <Input 
                                      type="number"
                                      value={editingPlan.total_cap}
                                      onChange={(e) => setEditingPlan({...editingPlan, total_cap: Number(e.target.value)})}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="checkbox"
                                    checked={editingPlan.is_active}
                                    onChange={(e) => setEditingPlan({...editingPlan, is_active: e.target.checked})}
                                  />
                                  <Label>Plano ativo</Label>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button 
                                onClick={() => {
                                  updatePlan(editingPlan.id, editingPlan);
                                  setEditingPlan(null);
                                }}
                                disabled={processing}
                              >
                                Salvar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Repasses Tab */}
        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Repasses</CardTitle>
              <CardDescription>Todos os repasses processados</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Calculado</TableHead>
                    <TableHead>Valor Final</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => {
                    const contract = contracts.find(c => c.id === payout.partner_contract_id);
                    return (
                      <TableRow key={payout.id}>
                        <TableCell>{formatMonth(payout.month)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{contract?.user_name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{contract?.plan_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatPrice(payout.calculated_amount)}</TableCell>
                        <TableCell className="font-medium">{formatPrice(payout.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={payout.status === 'PAID' ? 'default' : payout.status === 'PENDING' ? 'secondary' : 'destructive'}>
                            {payout.status === 'PAID' ? 'Pago' : payout.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payout.status === 'PENDING' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => markPayoutAsPaid(payout.id)}
                              disabled={processing}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Marcar Pago
                            </Button>
                          )}
                          {payout.paid_at && (
                            <span className="text-xs text-muted-foreground">
                              Pago em {formatDate(payout.paid_at)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {payouts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum repasse processado ainda
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processar Mês Tab */}
        <TabsContent value="process" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Processar Repasses do Mês
                </CardTitle>
                <CardDescription>
                  Calcule e distribua os repasses para todos os parceiros ativos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Mês de Referência</Label>
                  <Input 
                    type="month"
                    value={selectedMonth.slice(0, 7)}
                    onChange={(e) => setSelectedMonth(`${e.target.value}-01`)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>% do Faturamento para Fundo</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="number"
                      value={fundPercentage}
                      onChange={(e) => setFundPercentage(Number(e.target.value))}
                      min={0}
                      max={100}
                    />
                    <Button variant="outline" onClick={handleSaveFundPercentage}>
                      Salvar
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Contratos ativos:</span>
                    <span className="font-medium">{stats.activeContracts}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total em aportes:</span>
                    <span className="font-medium">{formatPrice(stats.totalAportes)}</span>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleProcessPayouts}
                  disabled={processing || stats.activeContracts === 0}
                >
                  {processing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Processar Repasses
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Histórico de Meses
                </CardTitle>
                <CardDescription>
                  Snapshots mensais do faturamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {snapshots.length > 0 ? (
                  <div className="space-y-3">
                    {snapshots.slice(0, 6).map((snapshot) => (
                      <div key={snapshot.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{formatMonth(snapshot.month)}</p>
                          <p className="text-xs text-muted-foreground">
                            Faturamento: {formatPrice(snapshot.gross_revenue)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">{formatPrice(snapshot.partner_fund_value)}</p>
                          <p className="text-xs text-muted-foreground">{snapshot.partner_fund_percentage}% do fat.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum snapshot ainda</p>
                    <p className="text-sm">Processe o primeiro mês para gerar dados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPartnerManagement;
