import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePurchaseProcessor } from '@/hooks/usePurchaseProcessor';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';
import { 
  User, 
  CreditCard, 
  History, 
  Trophy, 
  Zap, 
  TrendingUp,
  ShoppingCart,
  LogOut,
  PieChart,
  Target,
  Package,
  Bell,
  BarChart3,
  Users,
  ExternalLink,
  Briefcase,
  ArrowRight
} from 'lucide-react';
import { Header } from '@/components/Header';
import { BidPackages } from '@/components/BidPackages';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import { AuctionHistory } from '@/components/AuctionHistory';
import { SignupBonusWelcome } from '@/components/SignupBonusWelcome';
import { UserOrders } from '@/components/UserOrders';
import { PersonalAnalytics } from '@/components/PersonalAnalytics';
import { NotificationSettings } from '@/components/NotificationSettings';
import PartnerDashboard from '@/components/Partner/PartnerDashboard';

interface Bid {
  id: string;
  auction_id: string;
  bid_amount: number;
  cost_paid: number;
  created_at: string;
  auctions: {
    title: string;
    status: string;
  };
}

interface Purchase {
  id: string;
  bids_purchased: number;
  amount_paid: number;
  payment_status: string;
  created_at: string;
  bid_packages: {
    name: string;
  };
}

const UserDashboard = () => {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const { processPurchase, processing } = usePurchaseProcessor();
  const isMobile = useIsMobile();
  const [bids, setBids] = useState<Bid[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAffiliate, setIsAffiliate] = useState<boolean | null>(null);
  const [hasPartnerContract, setHasPartnerContract] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (profile?.user_id) {
      fetchUserData();
    }
  }, [profile?.user_id]);

  const fetchUserData = async () => {
    if (!profile?.user_id) return;
    
    try {
      // Fetch user bids - ONLY for the current user
      const { data: bidsData } = await supabase
        .from('bids')
        .select(`
          *,
          auctions (
            title,
            status
          )
        `)
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch user purchases - ONLY for the current user
      const { data: purchasesData } = await supabase
        .from('bid_purchases')
        .select(`
          *,
          bid_packages (
            name
          )
        `)
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Verificar se o usuário já é afiliado
      const { data: affiliateData } = await supabase
        .from('affiliates')
        .select('id, status')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      // Verificar se o usuário tem contrato de parceiro ativo
      const { data: partnerData } = await supabase
        .from('partner_contracts')
        .select('id, status')
        .eq('user_id', profile.user_id)
        .in('status', ['active', 'pending'])
        .maybeSingle();

      setIsAffiliate(!!affiliateData);
      setHasPartnerContract(!!partnerData);
      setBids(bidsData || []);
      setPurchases(purchasesData || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId: string, bidsCount: number, price: number) => {
    const result = await processPurchase(packageId, bidsCount, price);
    
    if (result.success) {
      // Recarregar dados do usuário após compra bem-sucedida
      fetchUserData();
      
      // Forçar atualização do contexto de auth para refletir novo saldo
      window.location.reload();
    }
  };

  const formatPrice = (priceInReais: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(priceInReais || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      <Header userBids={profile?.bids_balance || 0} onBuyBids={() => {}} />
      
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome bonus notification */}
        <SignupBonusWelcome />

        {/* Header do Dashboard */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Meu Painel</h1>
            <p className="text-muted-foreground">
              Bem-vindo, {profile?.full_name || 'Usuário'}!
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo de Lances</CardTitle>
              <Zap className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile?.bids_balance || 0}</div>
              <p className="text-xs text-muted-foreground">lances disponíveis</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Lances</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bids.length}</div>
              <p className="text-xs text-muted-foreground">lances dados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compras</CardTitle>
              <ShoppingCart className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{purchases.length}</div>
              <p className="text-xs text-muted-foreground">pacotes comprados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vitórias</CardTitle>
              <Trophy className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">leilões ganhos</p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Afiliados - Só mostra se NÃO for afiliado e dados já carregaram */}
        {!loading && isAffiliate === false && (
          <Card className="bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/20 rounded-full">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">💰 Ganhe Comissões Compartilhando!</h3>
                    <p className="text-sm text-muted-foreground">
                      Torne-se um afiliado e ganhe 10% de comissão em cada compra dos seus indicados
                    </p>
                  </div>
                </div>
                <Link to="/afiliado">
                  <Button size="lg" className="whitespace-nowrap">
                    Seja um Afiliado
                    <TrendingUp className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Atalho para Dashboard de Afiliado - Só mostra se É afiliado */}
        {!loading && isAffiliate === true && (
          <Card className="bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-teal-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/20 rounded-full">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">🎉 Você é um Afiliado!</h3>
                    <p className="text-sm text-muted-foreground">
                      Acesse seu painel para ver suas comissões, referências e ferramentas de divulgação
                    </p>
                  </div>
                </div>
                <Link to="/afiliado">
                  <Button size="lg" variant="outline" className="whitespace-nowrap border-green-500/50 hover:bg-green-500/10 text-green-600">
                    Meu Painel de Afiliado
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Parceiros - Mostrar para usuários que NÃO são parceiros */}
        {!loading && hasPartnerContract === false && (
          <Card className="bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-blue-500/10 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 rounded-full">
                    <Briefcase className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground">💎 Seja um Parceiro Investidor!</h3>
                      <Badge className="bg-purple-500 text-white text-xs">PRO</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Contribua com a plataforma e receba repasses semanais proporcionais ao faturamento
                    </p>
                  </div>
                </div>
                <Link to="/parceiro">
                  <Button size="lg" className="whitespace-nowrap bg-purple-600 hover:bg-purple-700">
                    Conhecer Programa
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Atalho para Dashboard de Parceiro - Mostrar para usuários que SÃO parceiros */}
        {!loading && hasPartnerContract === true && (
          <Card className="bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-blue-500/10 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 rounded-full">
                    <Briefcase className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">💎 Você é um Parceiro!</h3>
                    <p className="text-sm text-muted-foreground">
                      Acesse seu painel para ver seus repasses semanais e evolução
                    </p>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="whitespace-nowrap border-purple-500/50 hover:bg-purple-500/10 text-purple-600"
                  onClick={() => setActiveTab('investments')}
                >
                  Meu Painel de Parceiro
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs do Dashboard */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={isMobile 
            ? "flex w-full overflow-x-auto overflow-y-hidden scrollbar-hide" 
            : "grid w-full grid-cols-10"
          }>
            <TabsTrigger value="overview" className={isMobile ? "flex-shrink-0" : ""}>Visão Geral</TabsTrigger>
            <TabsTrigger value="orders" className={isMobile ? "flex-shrink-0" : ""}>Pedidos</TabsTrigger>
            <TabsTrigger value="bids" className={isMobile ? "flex-shrink-0" : ""}>Lances</TabsTrigger>
            <TabsTrigger value="auctions" className={isMobile ? "flex-shrink-0" : ""}>Leilões</TabsTrigger>
            <TabsTrigger value="financial" className={isMobile ? "flex-shrink-0" : ""}>Financeiro</TabsTrigger>
            <TabsTrigger value="packages" className={isMobile ? "flex-shrink-0" : ""}>Pacotes</TabsTrigger>
            <TabsTrigger 
              value="investments" 
              className={`${isMobile ? "flex-shrink-0" : ""} ${hasPartnerContract ? "relative after:absolute after:top-1 after:right-1 after:w-2 after:h-2 after:bg-purple-500 after:rounded-full" : ""}`}
            >
              <Briefcase className="h-4 w-4 mr-1" />
              Parcerias
            </TabsTrigger>
            <TabsTrigger value="analytics" className={isMobile ? "flex-shrink-0" : ""}>Analytics</TabsTrigger>
            <TabsTrigger value="notifications" className={isMobile ? "flex-shrink-0" : ""}>Notificações</TabsTrigger>
            <TabsTrigger value="profile" className={isMobile ? "flex-shrink-0" : ""}>Perfil</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Resumo Rápido */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Resumo de Atividades
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Lances disponíveis</span>
                    <span className="font-bold text-lg">{profile?.bids_balance || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Lances dados</span>
                    <span className="font-medium">{bids.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pacotes comprados</span>
                    <span className="font-medium">{purchases.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Leilões ganhos</span>
                    <span className="font-medium text-yellow-600">0</span>
                  </div>
                </CardContent>
              </Card>

              {/* Últimas Atividades */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <History className="mr-2 h-5 w-5" />
                    Últimas Atividades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bids.length > 0 ? (
                    <div className="space-y-3">
                      {bids.slice(0, 3).map((bid) => (
                        <div key={bid.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                          <div>
                            <p className="font-medium text-sm">{bid.auctions?.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(bid.created_at)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {formatPrice(bid.cost_paid)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4 text-sm">
                      Nenhuma atividade recente
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <UserOrders />
          </TabsContent>

          <TabsContent value="bids" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Lances</CardTitle>
              </CardHeader>
              <CardContent>
                {bids.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leilão</TableHead>
                        <TableHead>Valor do Lance</TableHead>
                        <TableHead>Custo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bids.map((bid) => (
                        <TableRow key={bid.id}>
                          <TableCell className="font-medium">
                            {bid.auctions?.title}
                          </TableCell>
                          <TableCell>{formatPrice(bid.bid_amount)}</TableCell>
                          <TableCell>{formatPrice(bid.cost_paid)}</TableCell>
                          <TableCell>
                            <Badge variant={bid.auctions?.status === 'active' ? 'default' : 'secondary'}>
                              {bid.auctions?.status === 'active' ? 'Ativo' : 'Finalizado'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(bid.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Você ainda não fez nenhum lance.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Compras</CardTitle>
              </CardHeader>
              <CardContent>
                {purchases.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pacote</TableHead>
                        <TableHead>Lances</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-medium">
                            {purchase.bid_packages?.name}
                          </TableCell>
                          <TableCell>{purchase.bids_purchased}</TableCell>
                          <TableCell>{formatPrice(purchase.amount_paid)}</TableCell>
                          <TableCell>
                            <Badge variant={purchase.payment_status === 'completed' ? 'default' : 'secondary'}>
                              {purchase.payment_status === 'completed' ? 'Concluído' : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(purchase.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Você ainda não comprou nenhum pacote.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auctions">
            <AuctionHistory />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialDashboard />
          </TabsContent>

          <TabsContent value="packages">
            <div className={processing ? 'pointer-events-none opacity-50' : ''}>
              <BidPackages onPurchase={handlePurchase} />
              {processing && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
                  <Card className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <div>
                        <p className="font-medium">Processando compra...</p>
                        <p className="text-sm text-muted-foreground">Por favor, aguarde</p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="investments" className="space-y-4">
            <PartnerDashboard />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Suas Estatísticas Pessoais</h2>
              </div>
              <PersonalAnalytics />
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Bell className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Configurações de Notificação</h2>
              </div>
              <NotificationSettings />
            </div>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Perfil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Nome Completo</label>
                    <p className="text-lg">{profile?.full_name || 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <p className="text-lg">{profile?.email || 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Membro desde</label>
                    <p className="text-lg">
                      {profile?.created_at ? formatDate(profile.created_at) : 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Saldo de Lances</label>
                    <p className="text-lg font-bold text-primary">
                      {profile?.bids_balance || 0} lances
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserDashboard;