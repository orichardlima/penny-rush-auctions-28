import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { 
  Users, 
  Gavel, 
  DollarSign, 
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  LogOut,
  BarChart3,
  Package,
  Settings,
  Upload,
  X
} from 'lucide-react';
import { FinancialSummaryCards } from '@/components/FinancialAnalytics/FinancialSummaryCards';
import { RevenueChart } from '@/components/FinancialAnalytics/RevenueChart';
import { AuctionFinancialCard } from '@/components/FinancialAnalytics/AuctionFinancialCard';
import { BidAnalytics } from '@/components/FinancialAnalytics/BidAnalytics';
import { useFinancialAnalytics } from '@/hooks/useFinancialAnalytics';


interface Auction {
  id: string;
  title: string;
  description: string;
  image_url: string;
  starting_price: number;
  current_price: number;
  status: string;
  total_bids: number;
  participants_count: number;
  created_at: string;
  market_value: number;
  revenue_target: number;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  bids_balance: number;
  is_admin: boolean;
  created_at: string;
}

interface BidPackage {
  id: string;
  name: string;
  bids_count: number;
  price: number;
  original_price?: number;
  is_popular: boolean;
  features: string[];
  created_at: string;
}

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [bidPackages, setBidPackages] = useState<BidPackage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Financial analytics
  const { 
    summary, 
    auctionDetails, 
    revenueTrends, 
    loading: analyticsLoading, 
    error: analyticsError,
    refreshData: refreshAnalytics 
  } = useFinancialAnalytics();
  const [newAuction, setNewAuction] = useState({
    title: '',
    description: '',
    image_url: '',
    starting_price: 100,
    market_value: 0,
    revenue_target: 0,
    starts_at: new Date().toISOString().slice(0, 16), // Format for datetime-local input
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      // Fetch auctions
      const { data: auctionsData } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch bid packages
      const { data: packagesData } = await supabase
        .from('bid_packages')
        .select('*')
        .order('created_at', { ascending: false });

      setAuctions(auctionsData || []);
      setUsers(usersData || []);
      setBidPackages(packagesData || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `auctions/${fileName}`;

    const { data, error } = await supabase.storage
      .from('auction-images')
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('auction-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const createAuction = async () => {
    if (!newAuction.title || !newAuction.description) {
      toast({
        title: 'Erro',
        description: 'Título e descrição são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      let imageUrl = newAuction.image_url;

      // Upload da imagem se selecionada
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const brazilTimezone = 'America/Sao_Paulo';
      const now = new Date();
      const nowInBrazil = toZonedTime(now, brazilTimezone);
      
      // Converter o horário local do admin para UTC considerando o fuso do Brasil
      const startsAtLocal = new Date(newAuction.starts_at);
      const startsAtUTC = fromZonedTime(startsAtLocal, brazilTimezone);
      
      // Determinar o status baseado no horário de início
      const status = startsAtUTC <= now ? 'active' : 'waiting';

      const { error } = await supabase
        .from('auctions')
        .insert([{
          title: newAuction.title,
          description: newAuction.description,
          image_url: imageUrl,
          starting_price: newAuction.starting_price,
          current_price: newAuction.starting_price,
          market_value: newAuction.market_value,
          revenue_target: newAuction.revenue_target,
          starts_at: startsAtUTC.toISOString(),
          status: status
        }]);

      if (error) throw error;

      toast({
        title: 'Leilão criado!',
        description: `Leilão criado com sucesso. Status: ${status === 'waiting' ? 'Aguardando início' : 'Ativo'}`,
      });

      setNewAuction({
        title: '',
        description: '',
        image_url: '',
        starting_price: 100,
        market_value: 0,
        revenue_target: 0,
        starts_at: new Date().toISOString().slice(0, 16),
      });
      setSelectedImage(null);

      fetchAdminData();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar leilão.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      // Preview da URL local
      const url = URL.createObjectURL(file);
      setNewAuction({...newAuction, image_url: url});
    }
  };

  const toggleUserAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !isAdmin })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Usuário atualizado!',
        description: `Usuário ${!isAdmin ? 'promovido a' : 'removido de'} administrador.`,
      });

      fetchAdminData();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar usuário.',
        variant: 'destructive',
      });
    }
  };

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(priceInCents / 100);
  };

  const formatDate = (dateString: string) => {
    const brazilTimezone = 'America/Sao_Paulo';
    const utcDate = new Date(dateString);
    const brazilDate = toZonedTime(utcDate, brazilTimezone);
    
    return format(brazilDate, 'dd/MM/yyyy HH:mm', { timeZone: brazilTimezone });
  };

  const deleteAuction = async (auctionId: string) => {
    try {
      const { error } = await supabase
        .from('auctions')
        .delete()
        .eq('id', auctionId);

      if (error) throw error;

      toast({
        title: 'Leilão excluído!',
        description: 'O leilão foi removido com sucesso.',
      });

      fetchAdminData();
    } catch (error) {
      console.error('Error deleting auction:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o leilão.',
        variant: 'destructive',
      });
    }
  };

  const editAuction = async () => {
    if (!editingAuction) return;
    
    try {
      setUploading(true);
      let imageUrl = editingAuction.image_url;

      // Upload nova imagem se selecionada
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const { error } = await supabase
        .from('auctions')
        .update({
          title: editingAuction.title,
          description: editingAuction.description,
          image_url: imageUrl,
          market_value: editingAuction.market_value * 100, // Convert to cents
          revenue_target: editingAuction.revenue_target * 100, // Convert to cents
        })
        .eq('id', editingAuction.id);

      if (error) throw error;

      toast({
        title: 'Leilão atualizado!',
        description: 'As informações do leilão foram atualizadas com sucesso.',
      });

      setEditingAuction(null);
      setSelectedImage(null);
      setIsEditDialogOpen(false);
      fetchAdminData();
    } catch (error) {
      console.error('Error updating auction:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o leilão.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEditClick = (auction: Auction) => {
    setEditingAuction({
      ...auction,
      market_value: auction.market_value / 100, // Convert from cents
      revenue_target: auction.revenue_target / 100, // Convert from cents
    });
    setSelectedImage(null);
    setIsEditDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalRevenue = bidPackages.reduce((sum, pkg) => sum + (pkg.price * 10), 0); // Simulated
  const activeAuctions = auctions.filter(a => a.status === 'active').length;
  const totalUsers = users.length;
  const totalBids = auctions.reduce((sum, auction) => sum + auction.total_bids, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Painel Administrativo</h1>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">usuários registrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leilões Ativos</CardTitle>
              <Gavel className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAuctions}</div>
              <p className="text-xs text-muted-foreground">leilões em andamento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Lances</CardTitle>
              <TrendingUp className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBids}</div>
              <p className="text-xs text-muted-foreground">lances realizados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Estimada</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">vendas de pacotes</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs do Dashboard Admin */}
        <Tabs defaultValue="financial" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
            <TabsTrigger value="auctions">Leilões</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="packages">Pacotes</TabsTrigger>
            <TabsTrigger value="analytics">Estatísticas</TabsTrigger>
          </TabsList>

          {/* Financial Analytics Tab */}
          <TabsContent value="financial" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Dashboard Financeiro</h2>
                <p className="text-muted-foreground">Análise completa do faturamento e performance</p>
              </div>
              <Button onClick={refreshAnalytics} disabled={analyticsLoading}>
                {analyticsLoading ? 'Atualizando...' : 'Atualizar Dados'}
              </Button>
            </div>

            {analyticsError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700">{analyticsError}</p>
              </div>
            )}

            {/* Summary Cards */}
            {summary && (
              <FinancialSummaryCards summary={summary} loading={analyticsLoading} />
            )}

            {/* Revenue Chart */}
            {revenueTrends.length > 0 && (
              <RevenueChart data={revenueTrends} loading={analyticsLoading} />
            )}

            {/* Bid Analytics */}
            {summary && (
              <BidAnalytics 
                totalBids={summary.total_bids}
                userBids={summary.user_bids}
                botBids={summary.bot_bids}
                auctionData={auctionDetails}
              />
            )}

            {/* Auction Financial Cards */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Performance por Leilão</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {auctionDetails.map((auction) => (
                  <AuctionFinancialCard 
                    key={auction.auction_id} 
                    auction={auction}
                    onClick={() => {
                      // Could open a detailed view modal here
                      console.log('Auction details:', auction);
                    }}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="auctions" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Gerenciar Leilões</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Leilão
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Leilão</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="title">Título do Produto *</Label>
                        <Input
                          id="title"
                          value={newAuction.title}
                          onChange={(e) => setNewAuction({...newAuction, title: e.target.value})}
                          placeholder="Ex: iPhone 15 Pro Max 256GB"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="starting_price">Preço Inicial (R$)</Label>
                        <Input
                          id="starting_price"
                          type="number"
                          step="0.01"
                          value={newAuction.starting_price / 100}
                          onChange={(e) => setNewAuction({...newAuction, starting_price: Math.round(parseFloat(e.target.value || '0') * 100)})}
                          placeholder="1.00"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Descrição do Produto *</Label>
                      <Textarea
                        id="description"
                        value={newAuction.description}
                        onChange={(e) => setNewAuction({...newAuction, description: e.target.value})}
                        placeholder="Descrição detalhada do produto, incluindo características, condições, etc."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="market_value">Valor na Loja (R$)</Label>
                        <Input
                          id="market_value"
                          type="number"
                          step="0.01"
                          value={newAuction.market_value / 100}
                          onChange={(e) => setNewAuction({...newAuction, market_value: Math.round(parseFloat(e.target.value || '0') * 100)})}
                          placeholder="8999.00"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Valor original do produto no mercado
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="revenue_target">Meta de Faturamento (R$)</Label>
                        <Input
                          id="revenue_target"
                          type="number"
                          step="0.01"
                          value={newAuction.revenue_target / 100}
                          onChange={(e) => setNewAuction({...newAuction, revenue_target: Math.round(parseFloat(e.target.value || '0') * 100)})}
                          placeholder="500.00"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Meta de faturamento do leilão
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="starts_at">Data e Hora de Início do Leilão</Label>
                      <Input
                        id="starts_at"
                        type="datetime-local"
                        value={newAuction.starts_at}
                        onChange={(e) => setNewAuction({...newAuction, starts_at: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Defina quando o leilão ficará disponível para os usuários
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="image">Imagem do Produto</Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            id="image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById('image') as HTMLInputElement;
                              input?.click();
                            }}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Escolher
                          </Button>
                        </div>
                        
                        {newAuction.image_url && (
                          <div className="relative w-full h-48 border rounded-lg overflow-hidden">
                            <img
                              src={newAuction.image_url}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => {
                                setNewAuction({...newAuction, image_url: ''});
                                setSelectedImage(null);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          Formatos aceitos: JPG, PNG, GIF. Tamanho máximo: 5MB
                        </p>
                      </div>
                    </div>

                    <Button 
                      onClick={createAuction} 
                      className="w-full"
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Criando Leilão...
                        </>
                      ) : (
                        'Criar Leilão'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Preço Atual</TableHead>
                      <TableHead>Lances</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auctions.map((auction) => (
                      <TableRow key={auction.id}>
                        <TableCell className="font-medium">{auction.title}</TableCell>
                        <TableCell>{formatPrice(auction.current_price)}</TableCell>
                        <TableCell>{auction.total_bids}</TableCell>
                        <TableCell>
                          <Badge variant={auction.status === 'active' ? 'default' : 'secondary'}>
                            {auction.status === 'active' ? 'Ativo' : 'Finalizado'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(auction.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditClick(auction)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja excluir este leilão?')) {
                                  deleteAuction(auction.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
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


          <TabsContent value="users" className="space-y-4">
            <h2 className="text-xl font-semibold">Gerenciar Usuários</h2>
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Saldo de Lances</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.bids_balance}</TableCell>
                        <TableCell>
                          <Badge variant={user.is_admin ? 'default' : 'secondary'}>
                            {user.is_admin ? 'Admin' : 'Usuário'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleUserAdmin(user.id, user.is_admin)}
                          >
                            {user.is_admin ? 'Remover Admin' : 'Tornar Admin'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="packages" className="space-y-4">
            <h2 className="text-xl font-semibold">Pacotes de Lances</h2>
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Lances</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Popular</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bidPackages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell>{pkg.bids_count}</TableCell>
                        <TableCell>{formatPrice(pkg.price)}</TableCell>
                        <TableCell>
                          <Badge variant={pkg.is_popular ? 'default' : 'secondary'}>
                            {pkg.is_popular ? 'Popular' : 'Normal'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(pkg.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <h2 className="text-xl font-semibold">Estatísticas Detalhadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Resumo Geral</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total de Usuários:</span>
                    <span className="font-bold">{totalUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Leilões Ativos:</span>
                    <span className="font-bold">{activeAuctions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total de Lances:</span>
                    <span className="font-bold">{totalBids}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Receita Estimada:</span>
                    <span className="font-bold">{formatPrice(totalRevenue)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Atividade Recente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Funcionalidade de analytics em desenvolvimento...
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Leilão</DialogTitle>
          </DialogHeader>
          {editingAuction && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-title">Título do Produto *</Label>
                  <Input
                    id="edit-title"
                    value={editingAuction.title}
                    onChange={(e) => setEditingAuction({...editingAuction, title: e.target.value})}
                    placeholder="Ex: iPhone 15 Pro Max 256GB"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-starting_price">Preço Inicial (R$)</Label>
                  <Input
                    id="edit-starting_price"
                    type="number"
                    step="0.01"
                    value={editingAuction.starting_price / 100}
                    onChange={(e) => setEditingAuction({...editingAuction, starting_price: Math.round(parseFloat(e.target.value || '0') * 100)})}
                    placeholder="1.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-description">Descrição do Produto *</Label>
                <Textarea
                  id="edit-description"
                  value={editingAuction.description}
                  onChange={(e) => setEditingAuction({...editingAuction, description: e.target.value})}
                  placeholder="Descrição detalhada do produto"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-market_value">Valor na Loja (R$)</Label>
                  <Input
                    id="edit-market_value"
                    type="number"
                    step="0.01"
                    value={editingAuction.market_value}
                    onChange={(e) => setEditingAuction({...editingAuction, market_value: parseFloat(e.target.value || '0')})}
                    placeholder="8999.00"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-revenue_target">Meta de Faturamento (R$)</Label>
                  <Input
                    id="edit-revenue_target"
                    type="number"
                    step="0.01"
                    value={editingAuction.revenue_target}
                    onChange={(e) => setEditingAuction({...editingAuction, revenue_target: parseFloat(e.target.value || '0')})}
                    placeholder="500.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-image">Imagem do Produto</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="edit-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById('edit-image') as HTMLInputElement;
                        input?.click();
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Escolher
                    </Button>
                  </div>
                  
                  {(editingAuction.image_url || selectedImage) && (
                    <div className="relative w-full h-48 border rounded-lg overflow-hidden">
                      <img
                        src={selectedImage ? URL.createObjectURL(selectedImage) : editingAuction.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setEditingAuction({...editingAuction, image_url: ''});
                          setSelectedImage(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={editAuction} 
                  className="flex-1"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingAuction(null);
                    setSelectedImage(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;