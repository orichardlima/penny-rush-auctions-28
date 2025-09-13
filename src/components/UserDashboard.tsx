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
  BarChart3
} from 'lucide-react';
import { Header } from '@/components/Header';
import { BidPackages } from '@/components/BidPackages';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import { AuctionHistory } from '@/components/AuctionHistory';
import { SignupBonusWelcome } from '@/components/SignupBonusWelcome';
import { UserOrders } from '@/components/UserOrders';
import { PersonalAnalytics } from '@/components/PersonalAnalytics';
import { NotificationSettings } from '@/components/NotificationSettings';

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
  const [bids, setBids] = useState<Bid[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

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

        {/* Tabs do Dashboard */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="bids">Lances</TabsTrigger>
            <TabsTrigger value="auctions">Leilões</TabsTrigger>
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
            <TabsTrigger value="packages">Pacotes</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
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