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
  Ban, RefreshCw, Trash2, Filter, Crown, UserPlus, Unlink, Users, Wallet
} from "lucide-react";
import { toast } from "sonner";
import { AffiliateMetricsCards } from "./Affiliate/AffiliateMetricsCards";
import { AffiliateAnalyticsCharts } from "./Affiliate/AffiliateAnalyticsCharts";
import { AffiliateTopRanking } from "./Affiliate/AffiliateTopRanking";
import { AffiliateDetailModal } from "./Affiliate/AffiliateDetailModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { EditCommissionModal } from "./Affiliate/EditCommissionModal";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAdminAffiliateManagers } from "@/hooks/useAffiliateManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { AffiliateMaterialsManager } from "./Admin/AffiliateMaterialsManager";
import { AdminAffiliateAuditLog } from "./Admin/AdminAffiliateAuditLog";

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
    updateAffiliateCommissionType,
    fetchCPAGoals,
    adjustAffiliateBalance,
  } = useAdminAffiliates();

  const { updateSetting, getSettingValue } = useSystemSettings();
  const {
    managerLinks,
    loading: managersLoading,
    promoteToManager,
    linkInfluencer,
    unlinkInfluencer,
    updateOverrideRate,
    refetch: refetchManagers,
  } = useAdminAffiliateManagers();

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
  const [editCommissionModalOpen, setEditCommissionModalOpen] = useState(false);
  const [editingCommissionAffiliate, setEditingCommissionAffiliate] = useState<any>(null);
  const [currentGoal, setCurrentGoal] = useState<any>(null);
  
  // Manager tab state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [selectedInfluencerId, setSelectedInfluencerId] = useState("");
  const [newOverrideRate, setNewOverrideRate] = useState("2");
  const [editOverrideId, setEditOverrideId] = useState<string | null>(null);
  const [editOverrideValue, setEditOverrideValue] = useState("");
  const [commissionAffiliateFilter, setCommissionAffiliateFilter] = useState("all");

  // Wallet adjustment state
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [walletAffiliate, setWalletAffiliate] = useState<any>(null);
  const [walletDestination, setWalletDestination] = useState<'affiliate' | 'partner'>('affiliate');
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("");
  const [walletConsumesCap, setWalletConsumesCap] = useState(true);
  const [walletPartnerContract, setWalletPartnerContract] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(false);

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
    return commissions.filter(c => {
      const matchesStatus = commissionFilter === "all" || c.status === commissionFilter;
      const matchesAffiliate = commissionAffiliateFilter === "all" || c.affiliate_id === commissionAffiliateFilter;
      return matchesStatus && matchesAffiliate;
    });
  }, [commissions, commissionFilter, commissionAffiliateFilter]);

  const commissionAffiliateOptions = useMemo(() => {
    const affiliateIds = [...new Set(commissions.map(c => c.affiliate_id))];
    return affiliateIds.map(id => {
      const aff = affiliates.find(a => a.id === id);
      return {
        id,
        label: aff ? `${aff.profiles?.full_name || 'Sem nome'} (${aff.affiliate_code})` : id.substring(0, 8),
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [commissions, affiliates]);

  const commissionSummary = useMemo(() => {
    const totalPurchases = filteredCommissions.reduce((sum, c) => sum + c.purchase_amount, 0);
    const totalCommissions = filteredCommissions.reduce((sum, c) => sum + c.commission_amount, 0);
    return { totalPurchases, totalCommissions };
  }, [filteredCommissions]);

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
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
          <TabsTrigger value="managers">Gerentes</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="withdrawals">Saques</TabsTrigger>
          <TabsTrigger value="materials">Materiais</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
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
                    <TableHead>Tipo</TableHead>
                    <TableHead>Taxa/Meta</TableHead>
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
                        <Badge variant={affiliate.commission_type === 'cpa' ? 'default' : 'secondary'}>
                          {affiliate.commission_type === 'cpa' ? 'CPA' : '%'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {affiliate.commission_type === 'cpa' ? (
                          <div className="text-xs">
                            <div className="font-medium">{formatPrice(affiliate.cpa_value_per_conversion)} × {affiliate.cpa_conversions_target}</div>
                            <div className="text-muted-foreground">= {formatPrice(affiliate.cpa_value_per_conversion * affiliate.cpa_conversions_target)}</div>
                          </div>
                        ) : (
                          <span>{affiliate.commission_rate}%</span>
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
                            onClick={async () => {
                              setEditingCommissionAffiliate(affiliate);
                              const goals = await fetchCPAGoals(affiliate.id);
                              const activeGoal = goals.find((g: any) => g.status === 'in_progress');
                              setCurrentGoal(activeGoal || null);
                              setEditCommissionModalOpen(true);
                            }}
                            title="Editar Comissão"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              setWalletAffiliate(affiliate);
                              setWalletDestination('affiliate');
                              setWalletAmount("");
                              setWalletReason("");
                              setWalletConsumesCap(true);
                              setWalletPartnerContract(null);
                              // Check if user has partner contract
                              const { data: contracts } = await supabase
                                .from('partner_contracts')
                                .select('id, plan_name, available_balance, status')
                                .eq('user_id', affiliate.user_id)
                                .eq('status', 'ACTIVE')
                                .limit(1);
                              if (contracts && contracts.length > 0) {
                                setWalletPartnerContract(contracts[0]);
                              }
                              setWalletDialogOpen(true);
                            }}
                            title="Ajustar Saldo"
                          >
                            <Wallet className="h-4 w-4" />
                          </Button>
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

        {/* Tab: Gerentes / Influencers */}
        <TabsContent value="managers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5" />
                    Gerentes & Influencers
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gerencie os vínculos entre gerentes e influencers
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setLinkDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Vincular Influencer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Promote to Manager */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Promover a Gerente
                </h4>
                <div className="flex gap-2">
                  <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um afiliado..." />
                    </SelectTrigger>
                    <SelectContent>
                      {affiliates
                        .filter(a => a.status === 'active' && (a as any).role !== 'manager')
                        .map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.profiles?.full_name || 'Sem nome'} ({a.affiliate_code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={async () => {
                      if (!selectedManagerId) return;
                      await promoteToManager(selectedManagerId);
                      setSelectedManagerId("");
                      refetchManagers();
                    }}
                    disabled={!selectedManagerId}
                  >
                    Promover
                  </Button>
                </div>
              </div>

              {/* Links Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gerente</TableHead>
                    <TableHead>Influencer</TableHead>
                    <TableHead>Override (%)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vinculado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managerLinks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum vínculo gerente↔influencer encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    managerLinks.map((link: any) => (
                      <TableRow key={link.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{link.manager_name}</div>
                            <code className="text-xs bg-muted px-1 rounded">{link.manager_code}</code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{link.influencer_name}</div>
                            <code className="text-xs bg-muted px-1 rounded">{link.influencer_code}</code>
                          </div>
                        </TableCell>
                        <TableCell>
                          {editOverrideId === link.id ? (
                            <div className="flex gap-1 items-center">
                              <Input
                                type="number"
                                value={editOverrideValue}
                                onChange={(e) => setEditOverrideValue(e.target.value)}
                                className="w-20 h-8"
                                step="0.5"
                                min="0"
                                max="50"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  const rate = parseFloat(editOverrideValue);
                                  if (!isNaN(rate) && rate >= 0 && rate <= 50) {
                                    await updateOverrideRate(link.id, rate);
                                    setEditOverrideId(null);
                                  }
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="cursor-pointer hover:underline"
                              onClick={() => {
                                setEditOverrideId(link.id);
                                setEditOverrideValue(String(link.override_rate));
                              }}
                            >
                              {link.override_rate}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={link.status === 'active' ? 'default' : 'secondary'}>
                            {link.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(link.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => unlinkInfluencer(link.id, link.influencer_affiliate_id)}
                            title="Desvincular"
                          >
                            <Unlink className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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
              <div className="flex gap-2 flex-wrap">
                  <Select value={commissionAffiliateFilter} onValueChange={setCommissionAffiliateFilter}>
                    <SelectTrigger className="w-[240px]">
                      <Users className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filtrar por afiliado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os afiliados</SelectItem>
                      {commissionAffiliateOptions.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <CardContent className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Download className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total em Compras</p>
                    <p className="text-lg font-bold">{formatPrice(commissionSummary.totalPurchases)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total em Comissões</p>
                    <p className="text-lg font-bold text-green-600">{formatPrice(commissionSummary.totalCommissions)}</p>
                  </div>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Indicado</TableHead>
                    <TableHead>Tipo</TableHead>
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
                      <TableCell>{(commission as any).referred_profile?.full_name || 'Usuário desconhecido'}</TableCell>
                      <TableCell>
                        {(commission as any).is_repurchase ? (
                          <Badge variant="outline" className="text-xs">Recompra</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">1ª Compra</Badge>
                        )}
                      </TableCell>
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

        <TabsContent value="materials" className="space-y-4">
          <AffiliateMaterialsManager />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AdminAffiliateAuditLog />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Programa de Afiliados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Comissões por Tipo de Afiliado</h3>
                <p className="text-sm text-muted-foreground">
                  Os afiliados são divididos em dois papéis: <strong>Manager</strong> (Parceiro de Expansão) e
                  <strong> Influencer</strong> (convidado por um Manager). Configure aqui as taxas aplicadas a cada tipo.
                </p>
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                    <div>
                      <Label>Manager — Primeira Compra (%)</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={getSettingValue("affiliate_manager_commission_rate", "50")}
                        onChange={(e) => updateSetting("affiliate_manager_commission_rate", e.target.value)}
                        step="0.5"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <Label>Manager — Recompras (%)</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={getSettingValue("affiliate_manager_repurchase_rate", "10")}
                        onChange={(e) => updateSetting("affiliate_manager_repurchase_rate", e.target.value)}
                        step="0.5"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                    <div>
                      <Label>Influencer — Primeira Compra (%)</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={getSettingValue("affiliate_influencer_commission_rate", "10")}
                        onChange={(e) => updateSetting("affiliate_influencer_commission_rate", e.target.value)}
                        step="0.5"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <Label>Influencer — Recompras (%)</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={getSettingValue("affiliate_influencer_repurchase_rate", "5")}
                        onChange={(e) => updateSetting("affiliate_influencer_repurchase_rate", e.target.value)}
                        step="0.5"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Override do Manager sobre Influencers (%)</Label>
                      <p className="text-sm text-muted-foreground">
                        Percentual extra que o Manager recebe sobre cada comissão dos seus Influencers.
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="w-24"
                      value={getSettingValue("affiliate_default_override_rate", "2")}
                      onChange={(e) => updateSetting("affiliate_default_override_rate", e.target.value)}
                      step="0.5"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Geral</h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between" style={{ display: 'none' }}>
                    <div>
                      <Label>Taxa de Comissão Padrão (legado) (%)</Label>
                    </div>
                    <Input
                      type="number"
                      className="w-24"
                      value={getSettingValue("affiliate_default_commission_rate", "10")}
                      onChange={(e) => updateSetting("affiliate_default_commission_rate", e.target.value)}
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
                <h3 className="font-semibold text-lg">Modelo de Comissão</h3>
                <div className="grid gap-4">
                  <div className="space-y-3">
                    <Label>Tipo de comissão padrão para novos afiliados</Label>
                    <RadioGroup 
                      value={getSettingValue("affiliate_commission_type", "percentage")}
                      onValueChange={(value) => updateSetting("affiliate_commission_type", value)}
                    >
                      <div className="flex items-start space-x-3 border rounded-lg p-4">
                        <RadioGroupItem value="percentage" id="settings-percentage" />
                        <div className="flex-1">
                          <Label htmlFor="settings-percentage" className="text-base font-medium cursor-pointer">
                            Porcentagem sobre compras
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            O afiliado ganha uma porcentagem do valor da primeira compra realizada por seus indicados
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 border rounded-lg p-4">
                        <RadioGroupItem value="cpa" id="settings-cpa" />
                        <div className="flex-1">
                          <Label htmlFor="settings-cpa" className="text-base font-medium cursor-pointer">
                            CPA - Meta de Depositantes
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            O afiliado ganha um valor fixo ao atingir uma meta de depositantes
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  {getSettingValue("affiliate_commission_type", "percentage") === "cpa" && (
                    <div className="bg-muted/30 rounded-lg p-4 space-y-4 border">
                      <h4 className="font-medium">Configurações CPA</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Valor por Depositante (R$)</Label>
                          <Input
                            type="number"
                            value={getSettingValue("affiliate_cpa_value_per_conversion", "5")}
                            onChange={(e) => updateSetting("affiliate_cpa_value_per_conversion", e.target.value)}
                            placeholder="5.00"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Valor pago por cada depositante
                          </p>
                        </div>
                        <div>
                          <Label>Meta de Depositantes</Label>
                          <Input
                            type="number"
                            value={getSettingValue("affiliate_cpa_conversions_target", "50")}
                            onChange={(e) => updateSetting("affiliate_cpa_conversions_target", e.target.value)}
                            placeholder="50"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Número de depositantes para completar meta
                          </p>
                        </div>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                        <p className="text-sm font-medium">Recompensa por meta:</p>
                        <p className="text-xl font-bold text-primary">
                          {formatPrice(
                            parseFloat(getSettingValue("affiliate_cpa_value_per_conversion", "5")) *
                            parseInt(getSettingValue("affiliate_cpa_conversions_target", "50"))
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Renovar meta automaticamente</Label>
                          <p className="text-sm text-muted-foreground">
                            Criar novo ciclo de meta quando afiliado bater a atual
                          </p>
                        </div>
                        <Switch
                          checked={getSettingValue("affiliate_cpa_auto_renew_goal", true)}
                          onCheckedChange={(checked) =>
                            updateSetting("affiliate_cpa_auto_renew_goal", String(checked))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Recompras</h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Comissionar Recompras</Label>
                      <p className="text-sm text-muted-foreground">
                        Gerar comissão para o afiliado em todas as compras do indicado, não apenas na primeira
                      </p>
                    </div>
                    <Switch
                      checked={getSettingValue("affiliate_repurchase_enabled", false)}
                      onCheckedChange={(checked) =>
                        updateSetting("affiliate_repurchase_enabled", String(checked))
                      }
                    />
                  </div>
                  {getSettingValue("affiliate_repurchase_enabled", false) && (
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Taxa de Recompra Padrão (%)</Label>
                        <p className="text-sm text-muted-foreground">
                          Taxa aplicada nas recompras (pode ser sobrescrita individualmente por afiliado)
                        </p>
                      </div>
                      <Input
                        type="number"
                        className="w-24"
                        value={getSettingValue("affiliate_repurchase_commission_rate", "5")}
                        onChange={(e) =>
                          updateSetting("affiliate_repurchase_commission_rate", e.target.value)
                        }
                        step="0.5"
                        min="0"
                        max="100"
                      />
                    </div>
                  )}
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
                <h3 className="font-semibold text-lg">Gerentes & Influencers</h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Taxa de Override Padrão (%)</Label>
                      <p className="text-sm text-muted-foreground">
                        Taxa que o gerente recebe sobre vendas dos seus influencers ao vincular novos
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="w-24"
                      value={getSettingValue("affiliate_default_override_rate", "2")}
                      onChange={(e) =>
                        updateSetting("affiliate_default_override_rate", e.target.value)
                      }
                      step="0.5"
                      min="0"
                      max="50"
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

      <EditCommissionModal
        open={editCommissionModalOpen}
        onOpenChange={setEditCommissionModalOpen}
        affiliate={editingCommissionAffiliate}
        currentGoal={currentGoal}
        onSave={async (data) => {
          if (editingCommissionAffiliate) {
            await updateAffiliateCommissionType(editingCommissionAffiliate.id, data);
          }
        }}
      />

      {/* Dialog para vincular influencer */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Influencer a Gerente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Gerente</Label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gerente..." />
                </SelectTrigger>
                <SelectContent>
                  {affiliates
                    .filter(a => a.status === 'active' && ((a as any).role === 'manager' || (a as any).role === 'affiliate'))
                    .map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.profiles?.full_name || 'Sem nome'} ({a.affiliate_code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Influencer</Label>
              <Select value={selectedInfluencerId} onValueChange={setSelectedInfluencerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o influencer..." />
                </SelectTrigger>
                <SelectContent>
                  {affiliates
                    .filter(a => a.status === 'active' && a.id !== selectedManagerId && (a as any).role !== 'manager')
                    .map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.profiles?.full_name || 'Sem nome'} ({a.affiliate_code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Taxa de Override (%)</Label>
              <Input
                type="number"
                value={newOverrideRate}
                onChange={(e) => setNewOverrideRate(e.target.value)}
                placeholder="2"
                step="0.5"
                min="0"
                max="50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Porcentagem que o gerente ganha sobre o valor da venda do influencer
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!selectedManagerId || !selectedInfluencerId) return;
                const rate = parseFloat(newOverrideRate);
                if (isNaN(rate) || rate < 0 || rate > 50) {
                  toast.error("Taxa inválida (0-50%)");
                  return;
                }
                await promoteToManager(selectedManagerId);
                await linkInfluencer(selectedManagerId, selectedInfluencerId, rate);
                setLinkDialogOpen(false);
                setSelectedManagerId("");
                setSelectedInfluencerId("");
                setNewOverrideRate("2");
              }}
              disabled={!selectedManagerId || !selectedInfluencerId}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de ajuste de saldo */}
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Saldo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Afiliado</Label>
              <p className="font-medium">{walletAffiliate?.profiles?.full_name || 'Sem nome'}</p>
              <p className="text-xs text-muted-foreground">Saldo afiliado: {formatPrice(walletAffiliate?.commission_balance || 0)}</p>
              {walletPartnerContract && (
                <p className="text-xs text-muted-foreground">Saldo parceiro ({walletPartnerContract.plan_name}): {formatPrice(walletPartnerContract.available_balance || 0)}</p>
              )}
            </div>

            <div>
              <Label>Destino</Label>
              <RadioGroup value={walletDestination} onValueChange={(v: 'affiliate' | 'partner') => setWalletDestination(v)} className="mt-1">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="affiliate" id="dest-affiliate" />
                  <Label htmlFor="dest-affiliate" className="font-normal">Carteira Afiliado</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="partner" id="dest-partner" disabled={!walletPartnerContract} />
                  <Label htmlFor="dest-partner" className={`font-normal ${!walletPartnerContract ? 'text-muted-foreground' : ''}`}>
                    Carteira Parceiro {!walletPartnerContract && '(sem contrato ativo)'}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                placeholder="Ex: 100.00 ou -50.00"
              />
              <p className="text-xs text-muted-foreground mt-1">Use valor negativo para débito</p>
            </div>

            {walletDestination === 'partner' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="consumes-cap"
                  checked={walletConsumesCap}
                  onCheckedChange={(c) => setWalletConsumesCap(!!c)}
                />
                <Label htmlFor="consumes-cap" className="font-normal text-sm">Consome teto do contrato</Label>
              </div>
            )}

            <div>
              <Label>Justificativa *</Label>
              <Textarea
                value={walletReason}
                onChange={(e) => setWalletReason(e.target.value)}
                placeholder="Motivo do ajuste..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={walletLoading || !walletAmount || !walletReason.trim()}
              onClick={async () => {
                const amount = parseFloat(walletAmount);
                if (isNaN(amount) || amount === 0) {
                  toast.error("Valor inválido");
                  return;
                }
                if (!walletReason.trim()) {
                  toast.error("Justificativa obrigatória");
                  return;
                }
                setWalletLoading(true);
                try {
                  if (walletDestination === 'affiliate') {
                    await adjustAffiliateBalance(walletAffiliate.id, amount, walletReason.trim());
                  } else {
                    // Use partner manual credit system
                    const { data: { user } } = await supabase.auth.getUser();
                    const { error } = await supabase
                      .from('partner_manual_credits')
                      .insert({
                        partner_contract_id: walletPartnerContract.id,
                        amount,
                        description: walletReason.trim(),
                        created_by: user?.id,
                        consumes_cap: walletConsumesCap,
                      });
                    if (error) throw error;
                    // Update balance
                    const { error: updateError } = await supabase
                      .from('partner_contracts')
                      .update({
                        available_balance: walletPartnerContract.available_balance + amount,
                        ...(walletConsumesCap && amount > 0 ? { total_received: walletPartnerContract.total_received + amount } : {}),
                      })
                      .eq('id', walletPartnerContract.id);
                    if (updateError) throw updateError;
                    toast.success(`Saldo do parceiro ajustado!`);
                  }
                  setWalletDialogOpen(false);
                } catch (err: any) {
                  toast.error(err.message || 'Erro ao ajustar saldo');
                } finally {
                  setWalletLoading(false);
                }
              }}
            >
              {walletLoading ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
