import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { 
  User, 
  Bot, 
  Package, 
  DollarSign, 
  Target, 
  Users, 
  Edit, 
  Trash2, 
  Plus, 
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Play,
  Pause,
  RefreshCw,
  Settings,
  BarChart3,
  Calendar,
  Eye,
  TrendingUp,
  Filter,
  Search,
  Download,
  Shield,
  Brain
} from 'lucide-react';
import { FinancialSummaryCards } from '@/components/FinancialAnalytics/FinancialSummaryCards';
import { useFinancialAnalytics } from '@/hooks/useFinancialAnalytics';
import AuctionParticipantsTable from '@/components/AuctionParticipantsTable';
import { AuctionDetailView } from '@/components/AuctionDetailView';
import { AdminFinancialOverview } from '@/components/AdminFinancialOverview';
import UserProfileCard from '@/components/UserProfileCard';
import AdvancedAnalytics from '@/components/AdvancedAnalytics';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import AuditLogTable from '@/components/AuditLogTable';

interface Auction {
  id: string;
  title: string;
  description: string;
  image_url: string;
  current_price: number;
  starting_price: number;
  market_value: number;
  revenue_target: number;
  total_bids: number;
  time_left: number;
  status: string;
  winner_name?: string;
  winner_id?: string;
  participants_count: number;
  finished_at?: string;
  ends_at?: string;
  company_revenue: number;
  created_at: string;
  starts_at: string;
}

interface User {
  user_id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_bot: boolean;
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
  
  // Estados para novas funcionalidades
  const [selectedAuctionForDetails, setSelectedAuctionForDetails] = useState<string | null>(null);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<User | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'real' | 'bot' | 'vip' | 'active'>('all');

  // Estados existentes
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [realUsers, setRealUsers] = useState<User[]>([]);
  const [botUsers, setBotUsers] = useState<User[]>([]);
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
    starting_price: 1.00, // Agora em reais
    market_value: 0.00,   // Agora em reais
    revenue_target: 0.00, // Agora em reais
    starts_at: new Date().toISOString().slice(0, 16),
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAuctions, setSelectedAuctions] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch auctions
      const { data: auctionsData, error: auctionsError } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      if (auctionsError) throw auctionsError;
      setAuctions(auctionsData || []);

      // Fetch real users
      const { data: realUsersData, error: realUsersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_bot', false)
        .order('created_at', { ascending: false });

      if (realUsersError) throw realUsersError;
      setRealUsers(realUsersData || []);

      // Fetch bot users
      const { data: botUsersData, error: botUsersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_bot', true)
        .order('created_at', { ascending: false });

      if (botUsersError) throw botUsersError;
      setBotUsers(botUsersData || []);

      // Fetch bid packages
      const { data: packagesData, error: packagesError } = await supabase
        .from('bid_packages')
        .select('*')
        .order('created_at', { ascending: false });

      if (packagesError) throw packagesError;
      setBidPackages(packagesData || []);

    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados administrativos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('auction-images')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('auction-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  // Função para converter reais para centavos
  const convertReaisToCents = (reais: number): number => {
    return Math.round(reais * 100);
  };

  const createAuction = async () => {
    if (!newAuction.title || !newAuction.description) {
      toast({
        title: "Erro",
        description: "Título e descrição são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      let imageUrl = newAuction.image_url;

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      // Converter valores de reais para centavos antes de inserir no banco
      const auctionData = {
        ...newAuction,
        image_url: imageUrl,
        starting_price: convertReaisToCents(newAuction.starting_price),
        market_value: convertReaisToCents(newAuction.market_value),
        revenue_target: convertReaisToCents(newAuction.revenue_target),
        current_price: convertReaisToCents(newAuction.starting_price),
      };

      const { error } = await supabase
        .from('auctions')
        .insert([auctionData]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Leilão criado com sucesso!"
      });

      // Reset form
      setNewAuction({
        title: '',
        description: '',
        image_url: '',
        starting_price: 1.00,
        market_value: 0.00,
        revenue_target: 0.00,
        starts_at: new Date().toISOString().slice(0, 16),
      });
      setSelectedImage(null);

      fetchAdminData();
    } catch (error) {
      console.error('Error creating auction:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar leilão",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Função para deletar leilão
  const deleteAuction = async (auctionId: string) => {
    try {
      const { error } = await supabase
        .from('auctions')
        .delete()
        .eq('id', auctionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Leilão deletado com sucesso!"
      });

      fetchAdminData();
    } catch (error) {
      console.error('Error deleting auction:', error);
      toast({
        title: "Erro",
        description: "Erro ao deletar leilão",
        variant: "destructive"
      });
    }
  };

  // Função para atualizar leilão
  const updateAuction = async () => {
    if (!editingAuction) return;

    try {
      const { error } = await supabase
        .from('auctions')
        .update({
          title: editingAuction.title,
          description: editingAuction.description,
          starting_price: convertReaisToCents(editingAuction.starting_price / 100), // Já vem em centavos, converter para reais primeiro
          market_value: convertReaisToCents(editingAuction.market_value / 100),
          revenue_target: convertReaisToCents(editingAuction.revenue_target / 100),
        })
        .eq('id', editingAuction.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Leilão atualizado com sucesso!"
      });

      setIsEditDialogOpen(false);
      setEditingAuction(null);
      fetchAdminData();
    } catch (error) {
      console.error('Error updating auction:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar leilão",
        variant: "destructive"
      });
    }
  };

  const toggleUserAdmin = async (userId: string, currentIsAdmin: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentIsAdmin })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Status de admin ${!currentIsAdmin ? 'ativado' : 'desativado'} com sucesso!`
      });

      fetchAdminData();
    } catch (error) {
      console.error('Error toggling admin:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status de admin",
        variant: "destructive"
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Filtrar usuários
  const filteredRealUsers = realUsers.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(userSearchTerm.toLowerCase());
    
    if (userFilter === 'all') return matchesSearch;
    if (userFilter === 'real') return matchesSearch && !user.is_bot;
    if (userFilter === 'bot') return matchesSearch && user.is_bot;
    return matchesSearch;
  });

  const refreshData = () => {
    fetchAdminData();
    refreshAnalytics();
  };

  const totalRevenue = bidPackages.reduce((sum, pkg) => sum + (pkg.price * 10), 0);
  const activeAuctions = auctions.filter(a => a.status === 'active').length;
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
            <Button variant="outline" onClick={refreshData} disabled={analyticsLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </Button>
            <Button variant="destructive" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>

        {/* Métricas resumo melhoradas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Reais: {(realUsers || []).length} | Bots: {(botUsers || []).length}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leilões Ativos</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{activeAuctions}</div>
              <p className="text-xs text-muted-foreground">
                Total de leilões: {auctions.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Lances</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{totalBids}</div>
              <p className="text-xs text-muted-foreground">
                Atividade total do sistema
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Estimada</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                R$ {summary?.total_revenue?.toFixed(2) || totalRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Baseado nos dados atuais
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Nova estrutura de tabs melhorada */}
        <Tabs defaultValue="auction-details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:grid-cols-6">
            <TabsTrigger value="auction-details" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Detalhes</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="auctions" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Leilões</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="packages" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Pacotes</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
          </TabsList>


          {/* Aba Unificada: Detalhes Completos do Leilão */}
          <TabsContent value="auction-details" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Detalhes Completos do Leilão</h2>
                <p className="text-muted-foreground">Visão 360° com todas as informações, métricas e participantes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar de seleção de leilão */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Selecionar Leilão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {auctions.map((auction) => (
                    <Button
                      key={auction.id}
                      variant={selectedAuctionForDetails === auction.id ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedAuctionForDetails(auction.id)}
                    >
                      <div className="text-left">
                        <div className="font-medium truncate">{auction.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {auction.total_bids} lances • {auction.status}
                        </div>
                      </div>
                    </Button>
                  ))}
                </CardContent>
              </Card>

              {/* View completa do leilão selecionado */}
              <div className="lg:col-span-3">
                {selectedAuctionForDetails ? (
                  <AuctionDetailView
                    auction={auctions.find(a => a.id === selectedAuctionForDetails)!}
                    financialData={auctionDetails?.find(d => d.auction_id === selectedAuctionForDetails)}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="font-semibold mb-2">Selecione um Leilão</h3>
                      <p className="text-muted-foreground">
                        Escolha um leilão na lista ao lado para ver a análise completa com todas as informações, métricas financeiras e participantes
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Aba Financeira Administrativa */}
          <TabsContent value="financial" className="space-y-6">
            <AdminFinancialOverview auctions={auctions} users={[...realUsers, ...botUsers]} />
          </TabsContent>

          {/* Auctions Tab */}
          <TabsContent value="auctions" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Gerenciar Leilões</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Leilão
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Leilão</DialogTitle>
                    <DialogDescription>
                      Preencha os dados do novo leilão
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        value={newAuction.title}
                        onChange={(e) => setNewAuction({ ...newAuction, title: e.target.value })}
                        placeholder="Título do leilão"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={newAuction.description}
                        onChange={(e) => setNewAuction({ ...newAuction, description: e.target.value })}
                        placeholder="Descrição detalhada"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="image">Imagem</Label>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="starting_price">Preço Inicial (R$)</Label>
                        <Input
                          id="starting_price"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={newAuction.starting_price}
                          onChange={(e) => setNewAuction({ ...newAuction, starting_price: Number(e.target.value) })}
                          placeholder="1.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="market_value">Valor de Mercado (R$)</Label>
                        <Input
                          id="market_value"
                          type="number"
                          step="0.01"
                          min="0"
                          value={newAuction.market_value}
                          onChange={(e) => setNewAuction({ ...newAuction, market_value: Number(e.target.value) })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="revenue_target">Meta de Receita (R$)</Label>
                      <Input
                        id="revenue_target"
                        type="number"
                        step="0.01"
                        min="0"
                        value={newAuction.revenue_target}
                        onChange={(e) => setNewAuction({ ...newAuction, revenue_target: Number(e.target.value) })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="starts_at">Data de Início</Label>
                      <Input
                        id="starts_at"
                        type="datetime-local"
                        value={newAuction.starts_at}
                        onChange={(e) => setNewAuction({ ...newAuction, starts_at: e.target.value })}
                      />
                    </div>
                    <Button onClick={createAuction} disabled={uploading} className="w-full">
                      {uploading ? (
                        <>
                          <Upload className="h-4 w-4 mr-2 animate-spin" />
                          Criando...
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
                      <TableHead>Status</TableHead>
                      <TableHead>Preço Atual</TableHead>
                      <TableHead>Total de Lances</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auctions.map((auction) => (
                      <TableRow key={auction.id}>
                        <TableCell className="font-medium">{auction.title}</TableCell>
                        <TableCell>
                          <Badge variant={auction.status === 'active' ? 'default' : 'secondary'}>
                            {auction.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatPrice(auction.current_price)}</TableCell>
                        <TableCell>{auction.total_bids}</TableCell>
                        <TableCell>{formatDate(auction.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setEditingAuction(auction);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deletar Leilão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja deletar o leilão "{auction.title}"? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteAuction(auction.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Deletar
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

          {/* Aba de Usuários melhorada */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
                <p className="text-muted-foreground">Controle completo de usuários reais e bots</p>
              </div>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <span>{filteredRealUsers.length} usuários filtrados</span>
              </div>
            </div>

            {/* Controles de filtro e busca */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={userFilter} onValueChange={(value) => setUserFilter(value as any)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="real">Usuários Reais</SelectItem>
                    <SelectItem value="bot">Bots</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lista de usuários */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Usuários ({filteredRealUsers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredRealUsers.map((user) => (
                    <Button
                      key={user.user_id}
                      variant={selectedUserForProfile?.user_id === user.user_id ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedUserForProfile(user)}
                    >
                      <div className="text-left">
                        <div className="font-medium">{user.full_name || 'Usuário'}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </Button>
                  ))}
                </CardContent>
              </Card>

              {/* Perfil do usuário selecionado */}
              <div className="lg:col-span-2">
                {selectedUserForProfile ? (
                  <UserProfileCard
                    userId={selectedUserForProfile.user_id}
                    userName={selectedUserForProfile.full_name || 'Usuário'}
                    userEmail={selectedUserForProfile.email}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="font-semibold mb-2">Selecione um Usuário</h3>
                      <p className="text-muted-foreground">
                        Escolha um usuário na lista ao lado para ver detalhes e analytics
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Packages Tab */}
          <TabsContent value="packages" className="space-y-4">
            <h2 className="text-xl font-semibold">Pacotes de Lances</h2>
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Quantidade de Lances</TableHead>
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
                            {pkg.is_popular ? 'Sim' : 'Não'}
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

          {/* Nova aba: Analytics Avançado */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Analytics Avançado</h2>
                <p className="text-muted-foreground">Dashboard executivo com insights e métricas estratégicas</p>
              </div>
              <Button variant="outline" onClick={refreshData} disabled={analyticsLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
                Atualizar Analytics
              </Button>
            </div>

            <AdvancedAnalytics />

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
              <ActivityHeatmap />
            </div>
          </TabsContent>

          {/* Nova aba: Auditoria */}
          <TabsContent value="audit" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Log de Auditoria</h2>
                <p className="text-muted-foreground">Histórico completo de ações administrativas e segurança</p>
              </div>
            </div>

            <AuditLogTable />
          </TabsContent>
        </Tabs>

        {/* Dialog de Edição de Leilão */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Leilão</DialogTitle>
              <DialogDescription>
                Modifique os dados do leilão
              </DialogDescription>
            </DialogHeader>
            {editingAuction && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Título</Label>
                  <Input
                    id="edit-title"
                    value={editingAuction.title}
                    onChange={(e) => setEditingAuction({ ...editingAuction, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Textarea
                    id="edit-description"
                    value={editingAuction.description}
                    onChange={(e) => setEditingAuction({ ...editingAuction, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-starting-price">Preço Inicial (R$)</Label>
                    <Input
                      id="edit-starting-price"
                      type="number"
                      step="0.01"
                      value={(editingAuction.starting_price / 100).toFixed(2)}
                      onChange={(e) => setEditingAuction({ 
                        ...editingAuction, 
                        starting_price: Math.round(Number(e.target.value) * 100)
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-market-value">Valor de Mercado (R$)</Label>
                    <Input
                      id="edit-market-value"
                      type="number"
                      step="0.01"
                      value={(editingAuction.market_value / 100).toFixed(2)}
                      onChange={(e) => setEditingAuction({ 
                        ...editingAuction, 
                        market_value: Math.round(Number(e.target.value) * 100)
                      })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-revenue-target">Meta de Receita (R$)</Label>
                  <Input
                    id="edit-revenue-target"
                    type="number"
                    step="0.01"
                    value={(editingAuction.revenue_target / 100).toFixed(2)}
                    onChange={(e) => setEditingAuction({ 
                      ...editingAuction, 
                      revenue_target: Math.round(Number(e.target.value) * 100)
                    })}
                  />
                </div>
                <Button onClick={updateAuction} className="w-full">
                  Atualizar Leilão
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDashboard;