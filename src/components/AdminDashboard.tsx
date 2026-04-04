import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  Users, Package, DollarSign, Target, Activity, Settings,
  BarChart3, RefreshCw, Shield, Brain, Eye, Wallet, Flame,
  Handshake, LayoutTemplate, ShoppingCart
} from 'lucide-react';
import { AdminFinancialOverview } from '@/components/AdminFinancialOverview';
import AdvancedAnalytics from '@/components/AdvancedAnalytics';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import { AdminAuditLog } from '@/components/AdminAuditLog';
import { SystemSettings } from '@/components/SystemSettings';
import { AdminOrdersManagement } from '@/components/AdminOrdersManagement';
import { AuctionHistory } from '@/components/AuctionHistory';
import { AdminAffiliateManagement } from '@/components/AdminAffiliateManagement';
import { ProductTemplatesManager } from '@/components/Admin/ProductTemplatesManager';
import AdminPartnerManagement from '@/components/Admin/AdminPartnerManagement';
import { FuryVaultConfigManager } from '@/components/Admin/FuryVaultConfigManager';
import { Footer } from '@/components/Footer';

import AuctionDetailsTab from './AdminDashboard/AuctionDetailsTab';
import AuctionManagementTab from './AdminDashboard/AuctionManagementTab';
import UserManagementTab from './AdminDashboard/UserManagementTab';
import PackagesManagementTab from './AdminDashboard/PackagesManagementTab';
import RecentPurchasesTab from './AdminDashboard/RecentPurchasesTab';
import { Auction, User, BidPackage } from './AdminDashboard/types';

const AdminDashboard = () => {
  const { signOut } = useAuth();

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [realUsers, setRealUsers] = useState<User[]>([]);
  const [botUsers, setBotUsers] = useState<User[]>([]);
  const [bidPackages, setBidPackages] = useState<BidPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('auction-details');
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['auction-details']));

  // Dados financeiros compartilhados (vêm do AdminFinancialOverview)
  const [sharedSummary, setSharedSummary] = useState<any>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [refreshFinancialFn, setRefreshFinancialFn] = useState<(() => void) | null>(null);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    setMountedTabs(prev => {
      if (prev.has(value)) return prev;
      const next = new Set(prev);
      next.add(value);
      return next;
    });
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [auctionsRes, realUsersRes, botUsersRes, packagesRes] = await Promise.all([
        supabase.from('auctions').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('user_id, full_name, email, is_admin, is_bot, is_blocked, block_reason, bids_balance, created_at').eq('is_bot', false).order('created_at', { ascending: false }),
        supabase.from('profiles').select('user_id, full_name, email, is_admin, is_bot, is_blocked, block_reason, bids_balance, created_at').eq('is_bot', true).order('created_at', { ascending: false }),
        supabase.from('bid_packages').select('*').order('created_at', { ascending: false }),
      ]);

      if (auctionsRes.error) throw auctionsRes.error;
      if (realUsersRes.error) throw realUsersRes.error;
      if (botUsersRes.error) throw botUsersRes.error;
      if (packagesRes.error) throw packagesRes.error;

      const cleanAuctions = (auctionsRes.data || []).filter(
        (a) => !(a.status === 'finished' && ((a.total_bids ?? 0) <= 0))
      );
      setAuctions(cleanAuctions);
      setRealUsers(realUsersRes.data || []);
      setBotUsers(botUsersRes.data || []);
      setBidPackages(packagesRes.data || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({ title: "Erro", description: "Erro ao carregar dados administrativos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchAdminData();
    refreshFinancialFn?.();
  };

  // Calcular receita estimada a partir dos dados locais de auctions
  const estimatedRevenue = auctions.reduce((sum, a) => sum + (a.company_revenue || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeAuctions = auctions.filter((a) => a.status === 'active').length;
  const totalUsers = (realUsers || []).length + (botUsers || []).length;
  const totalBids = auctions.reduce((sum, auction) => sum + auction.total_bids, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Painel Administrativo Profissional
            </h1>
            <p className="text-muted-foreground mt-2">
              Dashboard completo com analytics avançados e controle total
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshData} disabled={financialLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${financialLoading ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </Button>
            <Button variant="destructive" onClick={signOut}>Sair</Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalUsers}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leilões Ativos</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{activeAuctions}</div>
              <p className="text-xs text-muted-foreground">Total de leilões: {auctions.length}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Lances</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{totalBids}</div>
              <p className="text-xs text-muted-foreground">Atividade total do sistema</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Estimada</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                R$ {sharedSummary?.total_revenue?.toFixed(2) || estimatedRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Baseado nos dados atuais</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto lg:grid lg:grid-cols-13 gap-1 pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <TabsTrigger value="auction-details" title="Detalhes" className="flex items-center gap-2 shrink-0">
              <Eye className="h-4 w-4" /><span className="hidden sm:inline">Detalhes</span>
            </TabsTrigger>
            <TabsTrigger value="financial" title="Financeiro" className="flex items-center gap-2 shrink-0">
              <DollarSign className="h-4 w-4" /><span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="orders" title="Pedidos" className="flex items-center gap-2 shrink-0">
              <Package className="h-4 w-4" /><span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="partners" title="Parceiros" className="flex items-center gap-2 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Wallet className="h-4 w-4" /><span className="hidden sm:inline">Parceiros</span>
            </TabsTrigger>
            <TabsTrigger value="affiliates" title="Afiliados" className="flex items-center gap-2 shrink-0">
              <Handshake className="h-4 w-4" /><span className="hidden sm:inline">Afiliados</span>
            </TabsTrigger>
            <TabsTrigger value="auctions" title="Leilões" className="flex items-center gap-2 shrink-0">
              <Activity className="h-4 w-4" /><span className="hidden sm:inline">Leilões</span>
            </TabsTrigger>
            <TabsTrigger value="users" title="Usuários" className="flex items-center gap-2 shrink-0">
              <Users className="h-4 w-4" /><span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="packages" title="Pacotes" className="flex items-center gap-2 shrink-0">
              <Package className="h-4 w-4" /><span className="hidden sm:inline">Pacotes</span>
            </TabsTrigger>
            <TabsTrigger value="templates" title="Templates" className="flex items-center gap-2 shrink-0">
              <LayoutTemplate className="h-4 w-4" /><span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" title="Analytics" className="flex items-center gap-2 shrink-0">
              <Brain className="h-4 w-4" /><span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="audit" title="Auditoria" className="flex items-center gap-2 shrink-0">
              <Shield className="h-4 w-4" /><span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
            <TabsTrigger value="settings" title="Configurações" className="flex items-center gap-2 shrink-0">
              <Settings className="h-4 w-4" /><span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="vault-config" title="Cofre Fúria" className="flex items-center gap-2 shrink-0">
              <Flame className="h-4 w-4" /><span className="hidden sm:inline">Cofre</span>
            </TabsTrigger>
            <TabsTrigger value="purchases" title="Compras" className="flex items-center gap-2 shrink-0">
              <ShoppingCart className="h-4 w-4" /><span className="hidden sm:inline">Compras</span>
            </TabsTrigger>
            <TabsTrigger value="my-history" title="Histórico" className="flex items-center gap-2 shrink-0">
              <Target className="h-4 w-4" /><span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="auction-details">
            <AuctionDetailsTab auctions={auctions} auctionDetails={[]} />
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            {mountedTabs.has('financial') && (
              <AdminFinancialOverview 
                auctions={auctions} 
                users={[...realUsers, ...botUsers]}
                onSummaryChange={setSharedSummary}
                onLoadingChange={setFinancialLoading}
                onRefreshFnReady={setRefreshFinancialFn}
              />
            )}
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            {mountedTabs.has('orders') && <AdminOrdersManagement />}
          </TabsContent>

          <TabsContent value="partners" className="space-y-6">
            {mountedTabs.has('partners') && <AdminPartnerManagement />}
          </TabsContent>

          <TabsContent value="affiliates" className="space-y-6">
            {mountedTabs.has('affiliates') && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Gerenciamento de Afiliados</h2>
                    <p className="text-muted-foreground">Controle total sobre o programa de afiliados</p>
                  </div>
                </div>
                <AdminAffiliateManagement />
              </>
            )}
          </TabsContent>

          <TabsContent value="auctions">
            <AuctionManagementTab auctions={auctions} onRefresh={fetchAdminData} />
          </TabsContent>

          <TabsContent value="users">
            <UserManagementTab realUsers={realUsers} botUsers={botUsers} onRefresh={fetchAdminData} />
          </TabsContent>

          <TabsContent value="packages">
            <PackagesManagementTab bidPackages={bidPackages} onRefresh={fetchAdminData} />
          </TabsContent>

          <TabsContent value="purchases" className="space-y-6">
            {mountedTabs.has('purchases') && <RecentPurchasesTab />}
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            {mountedTabs.has('templates') && <ProductTemplatesManager />}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {mountedTabs.has('analytics') && (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">Analytics Avançado</h2>
                    <p className="text-muted-foreground">Dashboard executivo com insights e métricas estratégicas</p>
                  </div>
                  <Button variant="outline" onClick={refreshData} disabled={financialLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${financialLoading ? 'animate-spin' : ''}`} />
                    Atualizar Analytics
                  </Button>
                </div>
                <AdvancedAnalytics summary={sharedSummary} loading={financialLoading} />
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                  <ActivityHeatmap />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            {mountedTabs.has('audit') && (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">Log de Auditoria</h2>
                    <p className="text-muted-foreground">Histórico completo de ações administrativas e segurança</p>
                  </div>
                </div>
                <AdminAuditLog />
              </>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {mountedTabs.has('settings') && <SystemSettings />}
          </TabsContent>

          <TabsContent value="vault-config" className="space-y-6">
            {mountedTabs.has('vault-config') && <FuryVaultConfigManager />}
          </TabsContent>

          <TabsContent value="my-history" className="space-y-6">
            {mountedTabs.has('my-history') && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Meu Histórico de Leilões</h2>
                    <p className="text-muted-foreground">Seus lances e participações pessoais</p>
                  </div>
                </div>
                <AuctionHistory />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default AdminDashboard;