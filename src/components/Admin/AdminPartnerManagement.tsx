import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAdminPartners, ManualPayoutOptions, isContractEligibleForWeek, getWeekOptions, formatWeekRange } from '@/hooks/useAdminPartners';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { PartnerAnalyticsCharts } from './PartnerAnalyticsCharts';
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
  Calendar,
  Plus,
  Trash2,
  Download,
  BarChart3,
  Calculator
} from 'lucide-react';

const AdminPartnerManagement = () => {
  const { 
    contracts, 
    plans, 
    payouts, 
    snapshots,
    terminations,
    withdrawals,
    stats,
    loading, 
    processing,
    updateContractStatus,
    updatePlan,
    createPlan,
    deletePlan,
    cancelPayout,
    processWeeklyPayouts,
    markPayoutAsPaid,
    processTermination,
    
    rejectWithdrawal,
    markWithdrawalAsPaid,
    refreshData 
  } = useAdminPartners();

  const { getSettingValue, updateSetting } = useSystemSettings();

  const weekOptions = getWeekOptions(12);
  const [selectedWeek, setSelectedWeek] = useState(() => weekOptions[0]?.value || '');
  const [fundPercentage, setFundPercentage] = useState(getSettingValue('partner_fund_percentage', 20));
  const paymentDay = getSettingValue('partner_payment_day', 20);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  
  // Manual mode state
  const [calculationMode, setCalculationMode] = useState<'automatic' | 'manual'>('automatic');
  const [manualBase, setManualBase] = useState<'aporte' | 'monthly_cap'>('aporte');
  const [manualPercentage, setManualPercentage] = useState(5);
  const [manualDescription, setManualDescription] = useState('');
  
  // Create Plan State
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: '',
    display_name: '',
    aporte_value: 0,
    monthly_cap: 0,
    total_cap: 0,
    is_active: true,
    sort_order: 0,
    referral_bonus_percentage: 10
  });

  // Calculate preview for manual mode with eligibility check
  const activeContracts = contracts.filter(c => c.status === 'ACTIVE');
  const manualPreview = useMemo(() => {
    if (activeContracts.length === 0) return [];
    
    return activeContracts.map(contract => {
      const eligibility = isContractEligibleForWeek(contract.created_at, selectedWeek);
      const baseValue = manualBase === 'aporte' ? contract.aporte_value : contract.monthly_cap;
      let calculatedAmount = 0;
      
      if (eligibility.eligible && calculationMode === 'manual') {
        calculatedAmount = baseValue * (manualPercentage / 100);
        
        // Apply monthly cap if base is aporte
        if (manualBase === 'aporte' && calculatedAmount > contract.monthly_cap) {
          calculatedAmount = contract.monthly_cap;
        }
        
        // Apply total cap
        const remaining = contract.total_cap - contract.total_received;
        if (calculatedAmount > remaining) {
          calculatedAmount = Math.max(0, remaining);
        }
      }
      
      return {
        ...contract,
        baseValue,
        calculatedAmount,
        eligible: eligibility.eligible,
        eligibilityReason: eligibility.reason
      };
    });
  }, [calculationMode, manualBase, manualPercentage, activeContracts, selectedWeek]);

  const eligibleContracts = manualPreview.filter(p => p.eligible);
  const ineligibleContracts = manualPreview.filter(p => !p.eligible);
  const totalManualDistribution = eligibleContracts.reduce((sum, p) => sum + p.calculatedAmount, 0);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatPeriod = (periodStart: string, periodEnd?: string | null) => {
    return formatWeekRange(periodStart, periodEnd);
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
    if (!selectedWeek) return;
    
    if (calculationMode === 'manual') {
      const options: ManualPayoutOptions = {
        manualMode: true,
        manualBase,
        manualPercentage,
        manualDescription: manualDescription || undefined
      };
      await processWeeklyPayouts(selectedWeek, fundPercentage, options);
    } else {
      await processWeeklyPayouts(selectedWeek, fundPercentage, { 
        manualMode: false, 
        manualBase: 'aporte', 
        manualPercentage: 0
      });
    }
  };

  const handleSaveFundPercentage = async () => {
    await updateSetting('partner_fund_percentage', fundPercentage.toString());
  };

  const handleCreatePlan = async () => {
    if (!newPlan.name || !newPlan.display_name || newPlan.aporte_value <= 0) return;
    
    await createPlan(newPlan);
    setIsCreatingPlan(false);
    setNewPlan({
      name: '',
      display_name: '',
      aporte_value: 0,
      monthly_cap: 0,
      total_cap: 0,
      is_active: true,
      sort_order: plans.length,
      referral_bonus_percentage: 10
    });
  };

  const handleDeletePlan = async (planId: string) => {
    await deletePlan(planId);
  };

  const handleCancelPayout = async (payoutId: string) => {
    if (!cancelReason.trim()) return;
    await cancelPayout(payoutId, cancelReason);
    setCancelReason('');
  };

  // Export to CSV function
  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const key = h.toLowerCase().replace(/ /g, '_');
        const value = row[key] ?? '';
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportContracts = () => {
    const data = contracts.map(c => ({
      parceiro: c.user_name,
      email: c.user_email,
      plano: c.plan_name,
      aporte: c.aporte_value,
      recebido: c.total_received,
      teto: c.total_cap,
      status: c.status,
      criado_em: formatDate(c.created_at)
    }));
    exportToCSV(data, 'contratos_parceiros', ['Parceiro', 'Email', 'Plano', 'Aporte', 'Recebido', 'Teto', 'Status', 'Criado_em']);
  };

  const exportPayouts = () => {
    const data = payouts.map(p => {
      const contract = contracts.find(c => c.id === p.partner_contract_id);
      return {
        semana: formatPeriod(p.period_start, p.period_end),
        parceiro: contract?.user_name || 'N/A',
        plano: contract?.plan_name || 'N/A',
        calculado: p.calculated_amount,
        valor_final: p.amount,
        status: p.status,
        pago_em: p.paid_at ? formatDate(p.paid_at) : 'N/A'
      };
    });
    exportToCSV(data, 'repasses_parceiros', ['Semana', 'Parceiro', 'Plano', 'Calculado', 'Valor_final', 'Status', 'Pago_em']);
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
          <TabsTrigger value="withdrawals">
            Saques
            {stats.pendingWithdrawals > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
                {stats.pendingWithdrawals}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="terminations">
            Encerramentos
            {stats.pendingTerminations > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
                {stats.pendingTerminations}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="process">Processar Semana</TabsTrigger>
        </TabsList>

        {/* Contratos Tab */}
        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Todos os Contratos</CardTitle>
                <CardDescription>Lista de todos os contratos de parceiros</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportContracts}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Planos de Participação</CardTitle>
                <CardDescription>Configure os planos disponíveis</CardDescription>
              </div>
              <Dialog open={isCreatingPlan} onOpenChange={setIsCreatingPlan}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Plano
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Plano</DialogTitle>
                    <DialogDescription>
                      Configure os detalhes do novo plano de participação
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome Interno</Label>
                        <Input 
                          value={newPlan.name}
                          onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                          placeholder="ex: starter"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nome de Exibição</Label>
                        <Input 
                          value={newPlan.display_name}
                          onChange={(e) => setNewPlan({...newPlan, display_name: e.target.value})}
                          placeholder="ex: Plano Starter"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor do Aporte (R$)</Label>
                        <Input 
                          type="number"
                          value={newPlan.aporte_value}
                          onChange={(e) => setNewPlan({...newPlan, aporte_value: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Limite Mensal (R$)</Label>
                        <Input 
                          type="number"
                          value={newPlan.monthly_cap}
                          onChange={(e) => setNewPlan({...newPlan, monthly_cap: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Teto Total (R$)</Label>
                        <Input 
                          type="number"
                          value={newPlan.total_cap}
                          onChange={(e) => setNewPlan({...newPlan, total_cap: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ordem de Exibição</Label>
                        <Input 
                          type="number"
                          value={newPlan.sort_order}
                          onChange={(e) => setNewPlan({...newPlan, sort_order: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bônus Indicação (%)</Label>
                        <Input 
                          type="number"
                          min={0}
                          max={100}
                          value={newPlan.referral_bonus_percentage}
                          onChange={(e) => setNewPlan({...newPlan, referral_bonus_percentage: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        checked={newPlan.is_active}
                        onChange={(e) => setNewPlan({...newPlan, is_active: e.target.checked})}
                      />
                      <Label>Plano ativo</Label>
                    </div>
                    
                    {newPlan.aporte_value > 0 && newPlan.total_cap > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Retorno máximo: <span className="font-medium text-green-600">{((newPlan.total_cap / newPlan.aporte_value) * 100).toFixed(0)}%</span>
                        </p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreatingPlan(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreatePlan}
                      disabled={processing || !newPlan.name || !newPlan.display_name || newPlan.aporte_value <= 0}
                    >
                      {processing ? 'Criando...' : 'Criar Plano'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                    <TableHead>Bônus Ind.</TableHead>
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
                      <TableCell className="text-blue-600 font-medium">
                        {plan.referral_bonus_percentage ?? 10}%
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                          {plan.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
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
                                  <div className="space-y-2">
                                    <Label>Bônus Indicação (%)</Label>
                                    <Input 
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={editingPlan.referral_bonus_percentage ?? 10}
                                      onChange={(e) => setEditingPlan({...editingPlan, referral_bonus_percentage: Number(e.target.value)})}
                                    />
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
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deletar Plano</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {contracts.filter(c => c.plan_name === plan.name).length > 0 ? (
                                    <>
                                      Este plano possui contratos vinculados e será <strong>desativado</strong> (não deletado permanentemente).
                                    </>
                                  ) : (
                                    <>
                                      Este plano não possui contratos e será <strong>deletado permanentemente</strong>.
                                    </>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePlan(plan.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {contracts.filter(c => c.plan_name === plan.name).length > 0 ? 'Desativar' : 'Deletar'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Histórico de Repasses</CardTitle>
                <CardDescription>Todos os repasses processados</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportPayouts}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
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
                        <TableCell>{formatPeriod(payout.period_start, payout.period_end)}</TableCell>
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
                          <div className="flex gap-2">
                            {payout.status === 'PENDING' && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => markPayoutAsPaid(payout.id)}
                                  disabled={processing}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Pago
                                </Button>
                                
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Cancelar Repasse</DialogTitle>
                                      <DialogDescription>
                                        O valor será subtraído do total recebido do parceiro. Informe o motivo do cancelamento.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                        <p className="text-sm">
                                          <strong>Valor:</strong> {formatPrice(payout.amount)}
                                        </p>
                                        <p className="text-sm">
                                          <strong>Parceiro:</strong> {contract?.user_name}
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Motivo do cancelamento</Label>
                                        <Input 
                                          value={cancelReason}
                                          onChange={(e) => setCancelReason(e.target.value)}
                                          placeholder="Ex: Erro no cálculo, fraude detectada..."
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button 
                                        variant="destructive"
                                        onClick={() => handleCancelPayout(payout.id)}
                                        disabled={processing || !cancelReason.trim()}
                                      >
                                        Cancelar Repasse
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}
                            {payout.paid_at && (
                              <span className="text-xs text-muted-foreground">
                                Pago em {formatDate(payout.paid_at)}
                              </span>
                            )}
                          </div>
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

        {/* Saques Tab */}
        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Saque</CardTitle>
              <CardDescription>Gerencie as solicitações de saque dos parceiros</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>PIX</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{withdrawal.user_name}</p>
                          <p className="text-xs text-muted-foreground">{withdrawal.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{withdrawal.plan_name}</TableCell>
                      <TableCell className="font-medium">{formatPrice(withdrawal.amount)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{withdrawal.payment_details?.pix_key || '-'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{withdrawal.payment_details?.pix_key_type || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {withdrawal.status === 'APPROVED' && (
                          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Aguardando Pagamento</Badge>
                        )}
                        {withdrawal.status === 'PAID' && (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Pago</Badge>
                        )}
                        {withdrawal.status === 'REJECTED' && (
                          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rejeitado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(withdrawal.requested_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {withdrawal.status === 'APPROVED' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => markWithdrawalAsPaid(withdrawal.id)}
                                disabled={processing}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Pagar
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Rejeitar Saque</DialogTitle>
                                    <DialogDescription>
                                      Informe o motivo da rejeição
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="p-3 bg-muted rounded-lg text-sm">
                                      <p><strong>Parceiro:</strong> {withdrawal.user_name}</p>
                                      <p><strong>Valor:</strong> {formatPrice(withdrawal.amount)}</p>
                                      <p><strong>PIX:</strong> {withdrawal.payment_details?.pix_key}</p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Motivo da rejeição</Label>
                                      <Input
                                        id={`reject-reason-${withdrawal.id}`}
                                        placeholder="Ex: Dados de pagamento incorretos..."
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      variant="destructive"
                                      onClick={() => {
                                        const input = document.getElementById(`reject-reason-${withdrawal.id}`) as HTMLInputElement;
                                        if (input?.value) {
                                          rejectWithdrawal(withdrawal.id, input.value);
                                        }
                                      }}
                                      disabled={processing}
                                    >
                                      Rejeitar
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </>
                          )}
                          {withdrawal.status === 'PAID' && withdrawal.paid_at && (
                            <span className="text-xs text-green-600">
                              Pago em {formatDate(withdrawal.paid_at)}
                            </span>
                          )}
                          {withdrawal.status === 'REJECTED' && withdrawal.rejection_reason && (
                            <span className="text-xs text-red-600">
                              {withdrawal.rejection_reason}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {withdrawals.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação de saque
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Encerramentos Tab */}
        <TabsContent value="terminations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Encerramento Antecipado</CardTitle>
              <CardDescription>Gerencie as solicitações de encerramento de contratos</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor Proposto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terminations.map((term) => {
                    const contract = contracts.find(c => c.id === term.partner_contract_id);
                    return (
                      <TableRow key={term.id}>
                        <TableCell className="font-medium">{contract?.user_name || 'N/A'}</TableCell>
                        <TableCell>
                          {term.liquidation_type === 'CREDITS' && 'Créditos'}
                          {term.liquidation_type === 'BIDS' && `${term.bids_amount} Lances`}
                          {term.liquidation_type === 'PARTIAL_REFUND' && 'Reembolso'}
                        </TableCell>
                        <TableCell>{formatPrice(term.proposed_value)}</TableCell>
                        <TableCell>
                          <Badge variant={term.status === 'PENDING' ? 'secondary' : term.status === 'COMPLETED' ? 'default' : 'destructive'}>
                            {term.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(term.created_at)}</TableCell>
                        <TableCell>
                          {term.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => processTermination(term.id, 'approve')} disabled={processing}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => processTermination(term.id, 'reject')} disabled={processing}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {terminations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">Nenhuma solicitação de encerramento</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatórios Tab */}
        <TabsContent value="reports" className="space-y-4">
          <PartnerAnalyticsCharts
            snapshots={snapshots}
            payouts={payouts}
            contracts={contracts}
            plans={plans}
          />
        </TabsContent>

        {/* Processar Mês Tab */}
        <TabsContent value="process" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <CardContent className="space-y-6">
                {/* Modo de Cálculo */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Modo de Cálculo</Label>
                  <RadioGroup 
                    value={calculationMode} 
                    onValueChange={(v) => setCalculationMode(v as 'automatic' | 'manual')}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="automatic" id="automatic" />
                      <Label htmlFor="automatic" className="flex-1 cursor-pointer">
                        <span className="font-medium">Automático</span>
                        <p className="text-xs text-muted-foreground">Baseado no faturamento real da semana</p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="manual" id="manual" />
                      <Label htmlFor="manual" className="flex-1 cursor-pointer">
                        <span className="font-medium">Manual por Porcentagem</span>
                        <p className="text-xs text-muted-foreground">Definir % sobre aporte ou limite mensal</p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Configurações do Modo */}
                {calculationMode === 'automatic' ? (
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
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
                ) : (
                  <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="space-y-3">
                      <Label className="font-medium">Base de Cálculo</Label>
                      <RadioGroup 
                        value={manualBase} 
                        onValueChange={(v) => setManualBase(v as 'aporte' | 'monthly_cap')}
                        className="grid grid-cols-2 gap-2"
                      >
                        <div className="flex items-center space-x-2 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value="aporte" id="base-aporte" />
                          <Label htmlFor="base-aporte" className="cursor-pointer">
                            <span className="font-medium text-sm">Aporte</span>
                            <p className="text-xs text-muted-foreground">Valor investido</p>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value="monthly_cap" id="base-cap" />
                          <Label htmlFor="base-cap" className="cursor-pointer">
                            <span className="font-medium text-sm">Limite Mensal</span>
                            <p className="text-xs text-muted-foreground">Monthly cap</p>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label>Porcentagem (%)</Label>
                      <Input 
                        type="number"
                        value={manualPercentage}
                        onChange={(e) => setManualPercentage(Number(e.target.value))}
                        min={0}
                        max={100}
                        step={0.1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Descrição (opcional)</Label>
                      <Input 
                        value={manualDescription}
                        onChange={(e) => setManualDescription(e.target.value)}
                        placeholder="Ex: Repasse promocional Janeiro"
                      />
                    </div>
                  </div>
                )}

                {/* Semana de Referência */}
                <div className="space-y-2">
                  <Label>Semana de Referência</Label>
                  <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a semana" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOptions.map((week) => (
                        <SelectItem key={week.value} value={week.value}>
                          {week.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Resumo */}
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

            {/* Preview com Elegibilidade */}
            {manualPreview.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Preview da Distribuição
                  </CardTitle>
                  <CardDescription>
                    {calculationMode === 'manual' && ` ${manualPercentage}% sobre ${manualBase === 'aporte' ? 'o aporte' : 'o limite mensal'}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {/* Contratos elegíveis */}
                    {eligibleContracts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Elegíveis ({eligibleContracts.length})
                        </p>
                        {eligibleContracts.map((preview) => (
                          <div key={preview.id} className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{preview.user_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {preview.plan_name} • {preview.eligibilityReason}
                              </p>
                            </div>
                            <div className="text-right">
                              {calculationMode === 'manual' ? (
                                <>
                                  <p className="font-medium text-green-600">{formatPrice(preview.calculatedAmount)}</p>
                                  {preview.calculatedAmount < preview.baseValue * (manualPercentage / 100) && (
                                    <p className="text-xs text-yellow-600">Limite aplicado</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground">Proporcional ao aporte</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Contratos não elegíveis */}
                    {ineligibleContracts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-yellow-600 flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Aguardando próxima semana ({ineligibleContracts.length})
                        </p>
                        {ineligibleContracts.map((preview) => (
                          <div key={preview.id} className="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg opacity-75">
                            <div>
                              <p className="font-medium text-sm">{preview.user_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {preview.plan_name} • {preview.eligibilityReason}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-yellow-600">Próxima semana</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {calculationMode === 'manual' && eligibleContracts.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <span className="font-medium">Total a distribuir:</span>
                      <span className="text-xl font-bold text-green-600">{formatPrice(totalManualDistribution)}</span>
                    </div>
                  )}

                    {eligibleContracts.length === 0 && (
                      <div className="text-center py-4 text-yellow-600">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum contrato elegível para esta semana</p>
                        <p className="text-xs text-muted-foreground">Todos os contratos foram cadastrados após o início da semana</p>
                      </div>
                    )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Histórico de Semanas
                  </CardTitle>
                  <CardDescription>
                    Snapshots semanais dos repasses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshots.length > 0 ? (
                    <div className="space-y-3">
                      {snapshots.slice(0, 6).map((snapshot) => (
                        <div key={snapshot.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{formatPeriod(snapshot.period_start, snapshot.period_end)}</p>
                            {snapshot.is_manual ? (
                              <p className="text-xs text-orange-600">
                                {snapshot.manual_percentage}% sobre {snapshot.manual_base === 'aporte' ? 'aporte' : 'limite mensal'}
                                {snapshot.manual_description && ` • ${snapshot.manual_description}`}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Faturamento: {formatPrice(snapshot.gross_revenue)}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-600">{formatPrice(snapshot.partner_fund_value)}</p>
                            {snapshot.is_manual ? (
                              <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
                                Manual
                              </Badge>
                            ) : (
                              <p className="text-xs text-muted-foreground">{snapshot.partner_fund_percentage}% do fat.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum snapshot ainda</p>
                      <p className="text-sm">Processe a primeira semana para gerar dados</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPartnerManagement;
