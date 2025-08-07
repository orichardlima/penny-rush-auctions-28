import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  CreditCard, 
  History, 
  Trophy, 
  Zap, 
  TrendingUp,
  ShoppingCart,
  LogOut
} from 'lucide-react';
import { Header } from '@/components/Header';
import { BidPackages } from '@/components/BidPackages';

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
  const [bids, setBids] = useState<Bid[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // Fetch user bids
      const { data: bidsData } = await supabase
        .from('bids')
        .select(`
          *,
          auctions (
            title,
            status
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch user purchases
      const { data: purchasesData } = await supabase
        .from('bid_purchases')
        .select(`
          *,
          bid_packages (
            name
          )
        `)
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

  const handlePurchase = async (packageId: string, bidsCount: number) => {
    // Simular compra de pacote
    toast({
      title: 'Compra realizada!',
      description: `Você comprou ${bidsCount} lances com sucesso.`,
    });
    
    // Atualizar saldo de lances do usuário
    const newBalance = (profile?.bids_balance || 0) + bidsCount;
    
    // Aqui você implementaria a lógica real de pagamento
    // Por enquanto, vamos apenas simular
    const { error } = await supabase
      .from('profiles')
      .update({ bids_balance: newBalance })
      .eq('user_id', profile?.user_id);

    if (!error) {
      // Registrar a compra
      await supabase
        .from('bid_purchases')
        .insert([
          {
            user_id: profile?.user_id,
            package_id: packageId,
            bids_purchased: bidsCount,
            amount_paid: 0, // Seria o valor real do pacote
            payment_status: 'completed'
          }
        ]);
      
      fetchUserData();
    }
  };

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(priceInCents / 100);
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
        <Tabs defaultValue="bids" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="bids">Meus Lances</TabsTrigger>
            <TabsTrigger value="purchases">Compras</TabsTrigger>
            <TabsTrigger value="packages">Comprar Lances</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
          </TabsList>

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

          <TabsContent value="packages">
            <BidPackages onPurchase={handlePurchase} />
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