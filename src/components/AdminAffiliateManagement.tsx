import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAdminAffiliates } from "@/hooks/useAdminAffiliates";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Search, CheckCircle, XCircle, Edit, Eye, Copy, Download, 
  Ban, RefreshCw, Trash2, Filter
} from "lucide-react";
import { toast } from "sonner";
import { AffiliateMetricsCards } from "./Affiliate/AffiliateMetricsCards";
import { AffiliateAnalyticsCharts } from "./Affiliate/AffiliateAnalyticsCharts";
import { AffiliateTopRanking } from "./Affiliate/AffiliateTopRanking";
import { AffiliateDetailModal } from "./Affiliate/AffiliateDetailModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

export function AdminAffiliateManagement() {
  const {
    affiliates,
    commissions,
    withdrawals,
    loading,
    approveAffiliate,
    suspendAffiliate,
    updateCommissionRate,
    approveCommission,
    cancelCommission,
    processWithdrawal,
    rejectWithdrawal,
    reactivateAffiliate,
    deleteAffiliate,
    getAffiliateDetails,
    exportToCSV,
  } = useAdminAffiliates();

  const { updateSetting, getSettingValue } = useSystemSettings();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [commissionFilter, setCommissionFilter] = useState("all");
  const [withdrawalFilter, setWithdrawalFilter] = useState("all");
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [affiliateToDelete, setAffiliateToDelete] = useState<string | null>(null);
  const [selectedAffiliates, setSelectedAffiliates] = useState<string[]>([]);
  const [newCommissionRate, setNewCommissionRate] = useState<string>("");
  const [editingAffiliateId, setEditingAffiliateId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const activeAffiliates = affiliates.filter(a => a.status === 'active').length;
    const pendingAffiliates = affiliates.filter(a => a.status === 'pending').length;
    const pendingCommissionsValue = commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + c.commission_amount, 0);
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyConversions = affiliates.reduce((sum, a) => {
      const created = new Date(a.created_at);
      return created >= monthStart ? sum + a.total_conversions : sum;
    }, 0);

    const totalPaidCommissions = affiliates.reduce((sum, a) => sum + a.total_commission_paid, 0);
    
    const totalReferrals = affiliates.reduce((sum, a) => sum + a.total_referrals, 0);
    const totalConversions = affiliates.reduce((sum, a) => sum + a.total_conversions, 0);
    const conversionRate = totalReferrals > 0 ? (totalConversions / totalReferrals) * 100 : 0;

    const topAffiliate = [...affiliates]
      .sort((a, b) => b.total_conversions - a.total_conversions)[0];

    return {
      totalAffiliates: affiliates.length,
      activeAffiliates,
      pendingAffiliates,
      pendingCommissionsValue,
      monthlyConversions,
      totalPaidCommissions,
      conversionRate,
      topAffiliateOfMonth: topAffiliate?.profiles?.full_name || "N/A",
    };
  }, [affiliates, commissions]);

  const topAffiliates = useMemo(() => {
    return [...affiliates]
      .filter(a => a.total_conversions > 0)
      .sort((a, b) => b.total_commission_earned - a.total_commission_earned)
      .slice(0, 10)
      .map(a => ({
        id: a.id,
        name: a.profiles?.full_name || 'Sem nome',
        code: a.affiliate_code,
        conversions: a.total_conversions,
        totalEarned: a.total_commission_earned,
        conversionRate: a.total_referrals > 0 ? (a.total_conversions / a.total_referrals) * 100 : 0,
      }));
  }, [affiliates]);

  const chartData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return format(date, 'dd/MM');
    });

    const commissionTrends = last30Days.map(date => ({
      date,
      generated: Math.random() * 1000 + 500,
      paid: Math.random() * 800 + 300,
      pending: Math.random() * 200 + 100,
    }));

    const statusDistribution = {
      active: affiliates.filter(a => a.status === 'active').length,
      pending: affiliates.filter(a => a.status === 'pending').length,
      suspended: affiliates.filter(a => a.status === 'suspended').length,
    };

    return { commissionTrends, statusDistribution };
  }, [affiliates]);

  const filteredAffiliates = useMemo(() => {
    return affiliates.filter(a => {
      const matchesSearch = 
        a.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.affiliate_code.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [affiliates, searchTerm, statusFilter]);

  const filteredCommissions = useMemo(() => {
    return commissions.filter(c => 
      commissionFilter === "all" || c.status === commissionFilter
    );
  }, [commissions, commissionFilter]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter(w => 
      withdrawalFilter === "all" || w.status === withdrawalFilter
    );
  }, [withdrawals, withdrawalFilter]);

  const formatPrice = (price: number) => {
    return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: { variant: "default", label: "Ativo" },
      pending: { variant: "secondary", label: "Pendente" },
      suspended: { variant: "destructive", label: "Suspenso" },
      approved: { variant: "default", label: "Aprovado" },
      cancelled: { variant: "destructive", label: "Cancelado" },
      paid: { variant: "default", label: "Pago" },
      completed: { variant: "default", label: "Concluído" },
      rejected: { variant: "destructive", label: "Rejeitado" },
    };
    
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleViewDetails = async (affiliateId: string) => {
    const details = await getAffiliateDetails(affiliateId);
    if (details) {
      setSelectedAffiliate(details);
      setDetailModalOpen(true);
    }
  };

  const handleCopyLink = (code: string) => {
    const link = `${window.location.origin}/?ref=${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleEditRate = async (affiliateId: string) => {
    if (!newCommissionRate) return;
    const rate = parseFloat(newCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Taxa inválida");
      return;
    }
    await updateCommissionRate(affiliateId, rate);
    setEditingAffiliateId(null);
    setNewCommissionRate("");
  };

  const handleDeleteConfirm = async () => {
    if (affiliateToDelete) {
      await deleteAffiliate(affiliateToDelete);
      setDeleteDialogOpen(false);
      setAffiliateToDelete(null);
    }
  };

  const handleBatchApprove = async () => {
    for (const id of selectedAffiliates) {
      await approveAffiliate(id);
    }
    setSelectedAffiliates([]);
  };

  const handleBatchSuspend = async () => {
    for (const id of selectedAffiliates) {
      await suspendAffiliate(id);
    }
    setSelectedAffiliates([]);
  };

  const toggleSelectAll = () => {
    if (selectedAffiliates.length === filteredAffiliates.length) {
      setSelectedAffiliates([]);
    } else {
      setSelectedAffiliates(filteredAffiliates.map(a => a.id));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <AffiliateMetricsCards {...metrics} />

      <AffiliateAnalyticsCharts {...chartData} />

      <AffiliateTopRanking topAffiliates={topAffiliates} />

      <Tabs defaultValue="affiliates" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="withdrawals">Saques</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Afiliados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email ou código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="suspended">Suspensos</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => exportToCSV(filteredAffiliates, 'afiliados')} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>

              {selectedAffiliates.length > 0 && (
                <div className="flex gap-2">
                  <Button onClick={handleBatchApprove} size="sm">
                    Aprovar Selecionados ({selectedAffiliates.length})
                  </Button>
                  <Button onClick={handleBatchSuspend} variant="destructive" size="sm">
                    Suspender Selecionados
                  </Button>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedAffiliates.length === filteredAffiliates.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Conversões</TableHead>
                    <TableHead>Total Ganho</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAffiliates.map((affiliate) => (
                    <TableRow key={affiliate.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedAffiliates.includes(affiliate.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedAffiliates([...selectedAffiliates, affiliate.id]);
                            } else {
                              setSelectedAffiliates(selectedAffiliates.filter(id => id !== affiliate.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {affiliate.profiles?.full_name || "Sem nome"}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {affiliate.affiliate_code}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                      <TableCell>
                        {editingAffiliateId === affiliate.id ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={newCommissionRate}
                              onChange={(e) => setNewCommissionRate(e.target.value)}
                              className="w-20 h-8"
                              placeholder="%"
                            />
                            <Button size="sm" onClick={() => handleEditRate(affiliate.id)}>
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingAffiliateId(null)}>
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{affiliate.commission_rate}%</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingAffiliateId(affiliate.id);
                                setNewCommissionRate(affiliate.commission_rate.toString());
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{affiliate.total_conversions}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatPrice(affiliate.total_commission_earned)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatPrice(affiliate.commission_balance)}
                      </TableCell>
                      <TableCell>{formatDate(affiliate.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(affiliate.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyLink(affiliate.affiliate_code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {affiliate.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approveAffiliate(affiliate.id)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {affiliate.status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => suspendAffiliate(affiliate.id)}
                            >
                              <Ban className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                          {affiliate.status === "suspended" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => reactivateAffiliate(affiliate.id)}
                            >
                              <RefreshCw className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAffiliateToDelete(affiliate.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Gerenciar Comissões</CardTitle>
                <div className="flex gap-2">
                  <Select value={commissionFilter} onValueChange={setCommissionFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="approved">Aprovadas</SelectItem>
                      <SelectItem value="cancelled">Canceladas</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => exportToCSV(filteredCommissions, 'comissoes')} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Indicado</TableHead>
                    <TableHead>Valor Compra</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell>
                        {affiliates.find(a => a.id === commission.affiliate_id)?.profiles?.full_name || "Desconhecido"}
                      </TableCell>
                      <TableCell>Usuário #{commission.referred_user_id.substring(0, 8)}</TableCell>
                      <TableCell>{formatPrice(commission.purchase_amount)}</TableCell>
                      <TableCell>{commission.commission_rate}%</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatPrice(commission.commission_amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(commission.status)}</TableCell>
                      <TableCell>{formatDate(commission.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {commission.status === "pending" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approveCommission(commission.id)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelCommission(commission.id)}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Gerenciar Saques</CardTitle>
                <div className="flex gap-2">
                  <Select value={withdrawalFilter} onValueChange={setWithdrawalFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="completed">Concluídos</SelectItem>
                      <SelectItem value="rejected">Rejeitados</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => exportToCSV(filteredWithdrawals, 'saques')} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead>Processado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWithdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        {affiliates.find(a => a.id === withdrawal.affiliate_id)?.profiles?.full_name || "Desconhecido"}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatPrice(withdrawal.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{withdrawal.payment_method}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                      <TableCell>{formatDate(withdrawal.created_at)}</TableCell>
                      <TableCell>
                        {withdrawal.processed_at
                          ? formatDate(withdrawal.processed_at)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {withdrawal.status === "pending" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => processWithdrawal(withdrawal.id)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const reason = prompt("Motivo da rejeição:");
                                if (reason) rejectWithdrawal(withdrawal.id, reason);
                              }}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Programa de Afiliados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Geral</h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Taxa de Comissão Padrão (%)</Label>
                      <p className="text-sm text-muted-foreground">
                        Taxa aplicada a novos afiliados
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="w-24"
                      value={getSettingValue("affiliate_default_commission_rate", "10")}
                      onChange={(e) =>
                        updateSetting("affiliate_default_commission_rate", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-aprovar novos afiliados</Label>
                      <p className="text-sm text-muted-foreground">
                        Aprovar automaticamente sem revisão manual
                      </p>
                    </div>
                    <Switch
                      checked={getSettingValue("affiliate_auto_approve", false)}
                      onCheckedChange={(checked) =>
                        updateSetting("affiliate_auto_approve", String(checked))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Comissões</h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-aprovar comissões</Label>
                      <p className="text-sm text-muted-foreground">
                        Aprovar comissões automaticamente após o período de carência
                      </p>
                    </div>
                    <Switch
                      checked={getSettingValue("affiliate_commission_auto_approve", false)}
                      onCheckedChange={(checked) =>
                        updateSetting("affiliate_commission_auto_approve", String(checked))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Período de Carência (dias)</Label>
                      <p className="text-sm text-muted-foreground">
                        Dias antes de aprovar comissão automaticamente
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="w-24"
                      value={getSettingValue("affiliate_commission_delay_days", "7")}
                      onChange={(e) =>
                        updateSetting("affiliate_commission_delay_days", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Saques</h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Valor Mínimo para Saque (R$)</Label>
                      <p className="text-sm text-muted-foreground">
                        Valor mínimo que o afiliado pode solicitar
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="w-32"
                      value={getSettingValue("affiliate_min_withdrawal", "50")}
                      onChange={(e) =>
                        updateSetting("affiliate_min_withdrawal", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AffiliateDetailModal
        affiliate={selectedAffiliate}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onEditRate={(id) => {
          setEditingAffiliateId(id);
          setDetailModalOpen(false);
        }}
        onSuspend={async (id) => {
          await suspendAffiliate(id);
          setDetailModalOpen(false);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá deletar permanentemente o afiliado e todos os seus dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
