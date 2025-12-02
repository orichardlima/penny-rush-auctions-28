import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAdminAffiliates } from '@/hooks/useAdminAffiliates';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { CheckCircle, XCircle, Clock, DollarSign, Users, TrendingUp, Package, Edit, Ban, UserCheck, Eye } from 'lucide-react';
import { formatDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const AdminAffiliateManagement = () => {
  const {
    affiliates,
    commissions,
    withdrawals,
    loading,
    fetchAllData,
    approveAffiliate,
    suspendAffiliate,
    updateCommissionRate,
    approveCommission,
    cancelCommission,
    processWithdrawal,
    rejectWithdrawal,
  } = useAdminAffiliates();

  const {
    getSettingValue,
    updateSetting,
    loading: settingsLoading,
  } = useSystemSettings();

  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [newCommissionRate, setNewCommissionRate] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    return formatDate(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      pending: 'secondary',
      suspended: 'destructive',
      approved: 'default',
      paid: 'default',
      cancelled: 'destructive',
      completed: 'default',
      rejected: 'destructive',
    };

    const labels: Record<string, string> = {
      active: 'Ativo',
      pending: 'Pendente',
      suspended: 'Suspenso',
      approved: 'Aprovada',
      paid: 'Paga',
      cancelled: 'Cancelada',
      completed: 'Concluído',
      rejected: 'Rejeitado',
    };

    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  // Métricas
  const totalAffiliates = affiliates.length;
  const activeAffiliates = affiliates.filter(a => a.status === 'active').length;
  const pendingCommissions = commissions.filter(c => c.status === 'pending').length;
  const totalCommissionsAmount = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.commission_amount, 0);
  const monthConversions = commissions.filter(c => {
    const createdDate = new Date(c.created_at);
    const now = new Date();
    return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
  }).length;
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;
  const pendingWithdrawalsAmount = withdrawals
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0);

  const filteredAffiliates = statusFilter === 'all' 
    ? affiliates 
    : affiliates.filter(a => a.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Métricas Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Afiliados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAffiliates}</div>
            <p className="text-xs text-muted-foreground">
              {activeAffiliates} ativos • {affiliates.filter(a => a.status === 'pending').length} pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalCommissionsAmount)}</div>
            <p className="text-xs text-muted-foreground">{pendingCommissions} comissões aguardando</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversões do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthConversions}</div>
            <p className="text-xs text-muted-foreground">Conversões realizadas este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saques Pendentes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(pendingWithdrawalsAmount)}</div>
            <p className="text-xs text-muted-foreground">{pendingWithdrawals} solicitações</p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-abas */}
      <Tabs defaultValue="affiliates" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="affiliates">Lista de Afiliados</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="withdrawals">Saques</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Sub-aba: Lista de Afiliados */}
        <TabsContent value="affiliates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Lista de Afiliados</CardTitle>
                  <CardDescription>Gerencie todos os afiliados da plataforma</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={statusFilter === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('pending')}
                  >
                    Pendentes
                  </Button>
                  <Button
                    variant={statusFilter === 'active' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('active')}
                  >
                    Ativos
                  </Button>
                  <Button
                    variant={statusFilter === 'suspended' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('suspended')}
                  >
                    Suspensos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Indicações</TableHead>
                    <TableHead>Conversões</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell>
                    </TableRow>
                  ) : filteredAffiliates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum afiliado encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAffiliates.map((affiliate) => (
                      <TableRow key={affiliate.id}>
                        <TableCell className="font-medium">
                          {affiliate.profiles?.full_name || 'N/A'}
                          <div className="text-xs text-muted-foreground">{affiliate.profiles?.email}</div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{affiliate.affiliate_code}</code>
                        </TableCell>
                        <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                        <TableCell>{affiliate.commission_rate}%</TableCell>
                        <TableCell>{affiliate.total_referrals}</TableCell>
                        <TableCell>{affiliate.total_conversions}</TableCell>
                        <TableCell>{formatPrice(affiliate.commission_balance)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {affiliate.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveAffiliate(affiliate.id)}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Aprovar
                              </Button>
                            )}
                            {affiliate.status === 'active' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => suspendAffiliate(affiliate.id)}
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Suspender
                              </Button>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedAffiliate(affiliate);
                                    setNewCommissionRate(affiliate.commission_rate.toString());
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Taxa de Comissão</DialogTitle>
                                  <DialogDescription>
                                    {affiliate.profiles?.full_name} - {affiliate.affiliate_code}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="commission-rate">Nova Taxa (%)</Label>
                                    <Input
                                      id="commission-rate"
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.5"
                                      value={newCommissionRate}
                                      onChange={(e) => setNewCommissionRate(e.target.value)}
                                    />
                                  </div>
                                  <Button
                                    onClick={() => {
                                      updateCommissionRate(affiliate.id, parseFloat(newCommissionRate));
                                    }}
                                    className="w-full"
                                  >
                                    Atualizar Taxa
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sub-aba: Comissões */}
        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comissões</CardTitle>
              <CardDescription>Gerencie todas as comissões dos afiliados</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Valor Compra</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell>
                    </TableRow>
                  ) : commissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma comissão encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell className="font-medium">
                          {commission.affiliates?.profiles?.full_name || 'N/A'}
                          <div className="text-xs text-muted-foreground">
                            {commission.affiliates?.affiliate_code}
                          </div>
                        </TableCell>
                        <TableCell>{formatPrice(commission.purchase_amount)}</TableCell>
                        <TableCell>{commission.commission_rate}%</TableCell>
                        <TableCell className="font-semibold">{formatPrice(commission.commission_amount)}</TableCell>
                        <TableCell>{getStatusBadge(commission.status)}</TableCell>
                        <TableCell>{formatDateTime(commission.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {commission.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => approveCommission(commission.id)}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => cancelCommission(commission.id)}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Cancelar
                                </Button>
                              </>
                            )}
                            {commission.status === 'approved' && (
                              <Badge variant="default">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Aprovada
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sub-aba: Saques */}
        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Saque</CardTitle>
              <CardDescription>Gerencie os saques dos afiliados</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Chave PIX</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell>
                    </TableRow>
                  ) : withdrawals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma solicitação de saque
                      </TableCell>
                    </TableRow>
                  ) : (
                    withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="font-medium">
                          {withdrawal.affiliates?.profiles?.full_name || 'N/A'}
                          <div className="text-xs text-muted-foreground">
                            {withdrawal.affiliates?.affiliate_code}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{formatPrice(withdrawal.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{withdrawal.payment_method.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{withdrawal.affiliates?.pix_key || 'N/A'}</code>
                        </TableCell>
                        <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                        <TableCell>{formatDateTime(withdrawal.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {withdrawal.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => processWithdrawal(withdrawal.id)}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Aprovar
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Rejeitar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Rejeitar Saque</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Digite o motivo da rejeição
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <Textarea
                                      placeholder="Motivo da rejeição..."
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                    />
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => {
                                          rejectWithdrawal(withdrawal.id, rejectionReason);
                                          setRejectionReason('');
                                        }}
                                      >
                                        Rejeitar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sub-aba: Configurações */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Afiliados</CardTitle>
              <CardDescription>Configure regras globais do programa de afiliados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="default-rate">Taxa de Comissão Padrão (%)</Label>
                  <Input
                    id="default-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    defaultValue={getSettingValue('affiliate_default_commission_rate', '10')}
                    onBlur={(e) => updateSetting('affiliate_default_commission_rate', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Taxa aplicada a novos afiliados
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-withdrawal">Valor Mínimo para Saque (R$)</Label>
                  <Input
                    id="min-withdrawal"
                    type="number"
                    min="0"
                    step="10"
                    defaultValue={getSettingValue('affiliate_min_withdrawal', '50')}
                    onBlur={(e) => updateSetting('affiliate_min_withdrawal', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Saldo mínimo necessário para solicitar saque
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delay-days">Carência para Comissão (dias)</Label>
                  <Input
                    id="delay-days"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={getSettingValue('affiliate_commission_delay_days', '7')}
                    onBlur={(e) => updateSetting('affiliate_commission_delay_days', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Dias antes de aprovar comissão automaticamente
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Aprovação Automática de Afiliados</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = getSettingValue('affiliate_auto_approve', 'false') === 'true';
                        updateSetting('affiliate_auto_approve', (!current).toString());
                      }}
                    >
                      {getSettingValue('affiliate_auto_approve', 'false') === 'true' ? 'Ativado' : 'Desativado'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aprovar novos afiliados automaticamente
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Aprovação Automática de Comissões</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = getSettingValue('affiliate_commission_auto_approve', 'false') === 'true';
                        updateSetting('affiliate_commission_auto_approve', (!current).toString());
                      }}
                    >
                      {getSettingValue('affiliate_commission_auto_approve', 'false') === 'true' ? 'Ativado' : 'Desativado'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aprovar comissões automaticamente após período de carência
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
