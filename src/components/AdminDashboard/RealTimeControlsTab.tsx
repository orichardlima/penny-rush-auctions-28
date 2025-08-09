import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Timer, 
  DollarSign, 
  Settings,
  Users,
  Ban,
  UserX,
  User,
  Gavel,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Zap,
  Gauge,
  BarChart3
} from 'lucide-react';

interface LiveAuction {
  id: string;
  title: string;
  current_price: number;
  time_left: number;
  status: string;
  total_bids: number;
  participants_count: number;
  company_revenue: number;
  revenue_target: number;
  bid_increment: number;
  bid_cost: number;
  market_value: number;
}

interface UserControl {
  id: string;
  full_name: string;
  email: string;
  is_banned: boolean;
  bids_balance: number;
  total_spent: number;
  is_admin: boolean;
  created_at: string;
}

interface SystemMetrics {
  activeUsers: number;
  serverLoad: number;
  databaseConnections: number;
  responseTime: number;
  errorRate: number;
  uptime: number;
}

export const RealTimeControlsTab: React.FC = () => {
  const { toast } = useToast();
  const [liveAuctions, setLiveAuctions] = useState<LiveAuction[]>([]);
  const [userControls, setUserControls] = useState<UserControl[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    activeUsers: 0,
    serverLoad: 0,
    databaseConnections: 0,
    responseTime: 0,
    errorRate: 0,
    uptime: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<LiveAuction | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserControl | null>(null);

  // Live auction controls
  const [auctionControls, setAuctionControls] = useState({
    timeAdjustment: 0,
    priceAdjustment: 0,
    bidCostAdjustment: 0,
    incrementAdjustment: 0,
    autoExtension: true,
    emergencyStop: false
  });

  const fetchLiveAuctions = async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('status', 'active')
        .order('time_left', { ascending: true });

      if (error) throw error;
      setLiveAuctions(data || []);
    } catch (error) {
      console.error('Error fetching live auctions:', error);
    }
  };

  const fetchUserControls = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Mock additional data for demonstration
      const enrichedData = (data || []).map(user => ({
        ...user,
        is_banned: false, // In a real implementation, this would come from the database
        total_spent: Math.random() * 1000 // Mock data
      }));
      
      setUserControls(enrichedData);
    } catch (error) {
      console.error('Error fetching user controls:', error);
    }
  };

  const fetchSystemMetrics = async () => {
    // In a real implementation, these would come from monitoring services
    setSystemMetrics({
      activeUsers: Math.floor(Math.random() * 100) + 20,
      serverLoad: Math.random() * 100,
      databaseConnections: Math.floor(Math.random() * 50) + 10,
      responseTime: Math.random() * 500 + 50,
      errorRate: Math.random() * 5,
      uptime: 99.8 + Math.random() * 0.2
    });
  };

  const pauseAuction = async (auctionId: string) => {
    try {
      const { error } = await supabase
        .from('auctions')
        .update({ status: 'paused' })
        .eq('id', auctionId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Leilão pausado com sucesso'
      });

      fetchLiveAuctions();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao pausar leilão',
        variant: 'destructive'
      });
    }
  };

  const resumeAuction = async (auctionId: string) => {
    try {
      const { error } = await supabase
        .from('auctions')
        .update({ status: 'active' })
        .eq('id', auctionId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Leilão reativado com sucesso'
      });

      fetchLiveAuctions();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao reativar leilão',
        variant: 'destructive'
      });
    }
  };

  const adjustAuctionTimer = async (auctionId: string, newTime: number) => {
    try {
      const newEndsAt = new Date(Date.now() + newTime * 1000);
      
      const { error } = await supabase
        .from('auctions')
        .update({ 
          time_left: newTime,
          ends_at: newEndsAt.toISOString()
        })
        .eq('id', auctionId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Timer ajustado para ${newTime} segundos`
      });

      fetchLiveAuctions();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao ajustar timer',
        variant: 'destructive'
      });
    }
  };

  const adjustAuctionPrice = async (auctionId: string, newPrice: number) => {
    try {
      const { error } = await supabase
        .from('auctions')
        .update({ current_price: newPrice })
        .eq('id', auctionId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Preço ajustado para R$ ${(newPrice / 100).toFixed(2)}`
      });

      fetchLiveAuctions();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao ajustar preço',
        variant: 'destructive'
      });
    }
  };

  const banUser = async (userId: string) => {
    try {
      // In a real implementation, you would update a banned status
      // For now, we'll simulate this
      setUserControls(prev => 
        prev.map(user => 
          user.id === userId ? { ...user, is_banned: true } : user
        )
      );

      toast({
        title: 'Sucesso',
        description: 'Usuário banido com sucesso'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao banir usuário',
        variant: 'destructive'
      });
    }
  };

  const unbanUser = async (userId: string) => {
    try {
      setUserControls(prev => 
        prev.map(user => 
          user.id === userId ? { ...user, is_banned: false } : user
        )
      );

      toast({
        title: 'Sucesso',
        description: 'Usuário reativado com sucesso'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao reativar usuário',
        variant: 'destructive'
      });
    }
  };

  const adjustUserBalance = async (userId: string, newBalance: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', userId);

      if (error) throw error;

      setUserControls(prev => 
        prev.map(user => 
          user.id === userId ? { ...user, bids_balance: newBalance } : user
        )
      );

      toast({
        title: 'Sucesso',
        description: 'Saldo ajustado com sucesso'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao ajustar saldo',
        variant: 'destructive'
      });
    }
  };

  const emergencyStopAll = async () => {
    try {
      const { error } = await supabase
        .from('auctions')
        .update({ status: 'paused' })
        .eq('status', 'active');

      if (error) throw error;

      toast({
        title: 'PARADA DE EMERGÊNCIA',
        description: 'Todos os leilões foram pausados',
        variant: 'destructive'
      });

      fetchLiveAuctions();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro na parada de emergência',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    fetchLiveAuctions();
    fetchUserControls();
    fetchSystemMetrics();

    // Set up real-time updates
    const interval = setInterval(() => {
      fetchLiveAuctions();
      fetchSystemMetrics();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'paused': return 'destructive';
      case 'finished': return 'secondary';
      default: return 'secondary';
    }
  };

  const getMetricColor = (value: number, type: string) => {
    if (type === 'serverLoad') {
      if (value > 80) return 'text-destructive';
      if (value > 60) return 'text-warning';
      return 'text-success';
    }
    if (type === 'errorRate') {
      if (value > 5) return 'text-destructive';
      if (value > 2) return 'text-warning';
      return 'text-success';
    }
    if (type === 'responseTime') {
      if (value > 300) return 'text-destructive';
      if (value > 150) return 'text-warning';
      return 'text-success';
    }
    return 'text-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header with Emergency Controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div>
          <h2 className="text-2xl font-bold">Controles em Tempo Real</h2>
          <p className="text-muted-foreground">
            Gestão dinâmica de leilões e usuários
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={fetchLiveAuctions} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Parada de Emergência
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive">⚠️ PARADA DE EMERGÊNCIA</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Esta ação irá pausar TODOS os leilões ativos imediatamente. 
                  Use apenas em situações de emergência.
                </p>
                <Button onClick={emergencyStopAll} variant="destructive" className="w-full">
                  CONFIRMAR PARADA DE EMERGÊNCIA
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Usuários Online</p>
                <p className="text-lg font-bold">{systemMetrics.activeUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              <div>
                <p className="text-xs text-muted-foreground">Carga do Servidor</p>
                <p className={`text-lg font-bold ${getMetricColor(systemMetrics.serverLoad, 'serverLoad')}`}>
                  {systemMetrics.serverLoad.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <div>
                <p className="text-xs text-muted-foreground">Conexões DB</p>
                <p className="text-lg font-bold">{systemMetrics.databaseConnections}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <div>
                <p className="text-xs text-muted-foreground">Resp. Time</p>
                <p className={`text-lg font-bold ${getMetricColor(systemMetrics.responseTime, 'responseTime')}`}>
                  {systemMetrics.responseTime.toFixed(0)}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <div>
                <p className="text-xs text-muted-foreground">Taxa de Erro</p>
                <p className={`text-lg font-bold ${getMetricColor(systemMetrics.errorRate, 'errorRate')}`}>
                  {systemMetrics.errorRate.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">Uptime</p>
                <p className="text-lg font-bold text-success">{systemMetrics.uptime.toFixed(2)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Controls */}
      <Tabs defaultValue="auctions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="auctions">Controle de Leilões</TabsTrigger>
          <TabsTrigger value="users">Gestão de Usuários</TabsTrigger>
          <TabsTrigger value="automation">Automação</TabsTrigger>
        </TabsList>

        <TabsContent value="auctions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leilões Ativos ({liveAuctions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leilão</TableHead>
                    <TableHead>Preço Atual</TableHead>
                    <TableHead>Timer</TableHead>
                    <TableHead>Lances</TableHead>
                    <TableHead>Receita</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Controles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveAuctions.map((auction) => (
                    <TableRow key={auction.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{auction.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Meta: {formatPrice(auction.revenue_target || 0)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{formatPrice(auction.current_price)}</p>
                          <p className="text-xs text-muted-foreground">
                            +{formatPrice(auction.bid_increment)} por lance
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          <span className={`font-mono ${auction.time_left <= 10 ? 'text-destructive' : ''}`}>
                            {auction.time_left}s
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Gavel className="h-4 w-4" />
                          {auction.total_bids}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-success">
                            {formatPrice((auction.company_revenue || 0) * 100)}
                          </p>
                          {auction.revenue_target > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {(((auction.company_revenue || 0) * 100) / auction.revenue_target * 100).toFixed(1)}% da meta
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(auction.status)}>
                          {auction.status === 'active' ? 'Ativo' : 'Pausado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {auction.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => pauseAuction(auction.id)}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resumeAuction(auction.id)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Controles: {auction.title}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Ajustar Timer (segundos)</Label>
                                  <div className="flex gap-2 mt-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="300"
                                      defaultValue={auction.time_left}
                                      onChange={(e) => setAuctionControls(prev => ({ 
                                        ...prev, 
                                        timeAdjustment: parseInt(e.target.value) || 0 
                                      }))}
                                    />
                                    <Button onClick={() => adjustAuctionTimer(auction.id, auctionControls.timeAdjustment)}>
                                      Aplicar
                                    </Button>
                                  </div>
                                </div>

                                <div>
                                  <Label>Ajustar Preço (centavos)</Label>
                                  <div className="flex gap-2 mt-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      defaultValue={auction.current_price}
                                      onChange={(e) => setAuctionControls(prev => ({ 
                                        ...prev, 
                                        priceAdjustment: parseInt(e.target.value) || 0 
                                      }))}
                                    />
                                    <Button onClick={() => adjustAuctionPrice(auction.id, auctionControls.priceAdjustment)}>
                                      Aplicar
                                    </Button>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <Switch
                                    id={`auto-extension-${auction.id}`}
                                    checked={auctionControls.autoExtension}
                                    onCheckedChange={(checked) => setAuctionControls(prev => ({ 
                                      ...prev, 
                                      autoExtension: checked 
                                    }))}
                                  />
                                  <Label htmlFor={`auto-extension-${auction.id}`}>
                                    Extensão Automática
                                  </Label>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {liveAuctions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhum leilão ativo encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Usuários</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Gasto Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Controles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userControls.slice(0, 10).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            {user.is_admin && (
                              <Badge variant="secondary" className="text-xs">Admin</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell>
                        <span className="font-semibold">{user.bids_balance} lances</span>
                      </TableCell>
                      <TableCell>
                        {formatPrice(user.total_spent * 100)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_banned ? 'destructive' : 'default'}>
                          {user.is_banned ? 'Banido' : 'Ativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {user.is_banned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unbanUser(user.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => banUser(user.id)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Ajustar Saldo: {user.full_name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Novo Saldo de Lances</Label>
                                  <div className="flex gap-2 mt-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      defaultValue={user.bids_balance}
                                      onChange={(e) => setAuctionControls(prev => ({ 
                                        ...prev, 
                                        bidCostAdjustment: parseInt(e.target.value) || 0 
                                      }))}
                                    />
                                    <Button onClick={() => adjustUserBalance(user.id, auctionControls.bidCostAdjustment)}>
                                      Aplicar
                                    </Button>
                                  </div>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <p>Saldo atual: {user.bids_balance} lances</p>
                                  <p>Total gasto: {formatPrice(user.total_spent * 100)}</p>
                                  <p>Membro desde: {format(new Date(user.created_at), 'dd/MM/yyyy')}</p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Automação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Auto-Extensão de Leilões</Label>
                  <Switch 
                    checked={auctionControls.autoExtension}
                    onCheckedChange={(checked) => setAuctionControls(prev => ({ 
                      ...prev, 
                      autoExtension: checked 
                    }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Sistema de Bots Ativo</Label>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Monitoramento de Fraude</Label>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Backup Automático</Label>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas e Notificações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Limite de Carga do Servidor (%)</Label>
                  <Slider
                    defaultValue={[80]}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label>Limite de Tempo de Resposta (ms)</Label>
                  <Slider
                    defaultValue={[300]}
                    max={1000}
                    step={50}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label>Limite de Taxa de Erro (%)</Label>
                  <Slider
                    defaultValue={[5]}
                    max={20}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};