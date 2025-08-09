import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  Search, 
  Eye, 
  Ban, 
  CreditCard, 
  Trophy,
  Clock,
  TrendingUp,
  DollarSign,
  User
} from 'lucide-react';

interface UserDetail {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  bids_balance: number;
  is_admin: boolean;
  is_bot: boolean;
  created_at: string;
  totalBids: number;
  totalSpent: number;
  totalPurchases: number;
  auctionsWon: number;
  lastActivity: string;
}

interface UserAnalyticsTabProps {
  users: any[];
  onRefresh: () => void;
}

export const UserAnalyticsTab: React.FC<UserAnalyticsTabProps> = ({ users, onRefresh }) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);

  const fetchUserAnalytics = async () => {
    setLoading(true);
    try {
      const enrichedUsers = await Promise.all(
        users.map(async (user) => {
          // Fetch bid statistics
          const { data: bidsData } = await supabase
            .from('bids')
            .select('cost_paid, created_at')
            .eq('user_id', user.user_id);

          // Fetch purchase statistics
          const { data: purchasesData } = await supabase
            .from('bid_purchases')
            .select('amount_paid, created_at')
            .eq('user_id', user.user_id)
            .eq('payment_status', 'completed');

          // Fetch won auctions
          const { data: wonAuctions } = await supabase
            .from('auctions')
            .select('id')
            .eq('winner_id', user.user_id);

          const totalBids = bidsData?.length || 0;
          const totalSpent = bidsData?.reduce((sum, bid) => sum + bid.cost_paid, 0) || 0;
          const totalPurchases = purchasesData?.reduce((sum, purchase) => sum + purchase.amount_paid, 0) || 0;
          const auctionsWon = wonAuctions?.length || 0;
          
          // Last activity (most recent bid or purchase)
          const lastBid = bidsData?.[0]?.created_at;
          const lastPurchase = purchasesData?.[0]?.created_at;
          const lastActivity = lastBid && lastPurchase 
            ? (new Date(lastBid) > new Date(lastPurchase) ? lastBid : lastPurchase)
            : lastBid || lastPurchase || user.created_at;

          return {
            ...user,
            totalBids,
            totalSpent,
            totalPurchases,
            auctionsWon,
            lastActivity
          };
        })
      );

      setUserDetails(enrichedUsers);
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar analytics de usuários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (users.length > 0) {
      fetchUserAnalytics();
    }
  }, [users]);

  const filteredUsers = userDetails.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const updateUserBalance = async (userId: string, newBalance: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Saldo do usuário atualizado com sucesso.",
      });

      onRefresh();
      fetchUserAnalytics();
    } catch (error) {
      console.error('Error updating user balance:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar saldo do usuário.",
        variant: "destructive",
      });
    }
  };

  const getUserRiskLevel = (user: UserDetail) => {
    const ratio = user.totalPurchases > 0 ? user.totalSpent / user.totalPurchases : 0;
    if (ratio > 2) return { level: 'Alto', color: 'destructive' };
    if (ratio > 1) return { level: 'Médio', color: 'outline' };
    return { level: 'Baixo', color: 'secondary' };
  };

  return (
    <div className="space-y-6">
      {/* Header with search */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Análise de Usuários
          </h2>
          <p className="text-muted-foreground">
            Análise detalhada do comportamento e performance dos usuários
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button onClick={() => fetchUserAnalytics()} disabled={loading}>
            Atualizar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total de Usuários</p>
                <p className="text-xl font-bold">{userDetails.filter(u => !u.is_bot).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Usuários Pagantes</p>
                <p className="text-xl font-bold">
                  {userDetails.filter(u => u.totalPurchases > 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Usuários Ganhadores</p>
                <p className="text-xl font-bold">
                  {userDetails.filter(u => u.auctionsWon > 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Receita Total</p>
                <p className="text-xl font-bold">
                  {formatPrice(userDetails.reduce((sum, u) => sum + u.totalSpent, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista Detalhada de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Lances</TableHead>
                    <TableHead>Gasto Total</TableHead>
                    <TableHead>Compras</TableHead>
                    <TableHead>Vitórias</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Última Atividade</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.filter(user => !user.is_bot).map((user) => {
                    const risk = getUserRiskLevel(user);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {user.full_name || 'Nome não informado'}
                            {user.is_admin && (
                              <Badge variant="destructive" className="text-xs">Admin</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell className="text-center">{user.totalBids}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatPrice(user.totalSpent)}
                        </TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          {formatPrice(user.totalPurchases)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-1">
                            {user.auctionsWon > 0 && <Trophy className="h-3 w-3 text-yellow-500" />}
                            {user.auctionsWon}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {user.bids_balance} créditos
                        </TableCell>
                        <TableCell>
                          <Badge variant={risk.color as any} className="text-xs">
                            {risk.level}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.lastActivity)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedUser(user)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Detalhes do Usuário</DialogTitle>
                                </DialogHeader>
                                {selectedUser && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm font-medium">Nome Completo</p>
                                        <p className="text-sm text-muted-foreground">
                                          {selectedUser.full_name || 'Não informado'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Email</p>
                                        <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Total de Lances</p>
                                        <p className="text-lg font-bold">{selectedUser.totalBids}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Leilões Vencidos</p>
                                        <p className="text-lg font-bold text-yellow-600">{selectedUser.auctionsWon}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Total Gasto em Lances</p>
                                        <p className="text-lg font-bold text-green-600">
                                          {formatPrice(selectedUser.totalSpent)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Total em Compras</p>
                                        <p className="text-lg font-bold text-blue-600">
                                          {formatPrice(selectedUser.totalPurchases)}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                      <Input
                                        type="number"
                                        placeholder="Novo saldo de créditos"
                                        className="flex-1"
                                        id={`balance-${selectedUser.id}`}
                                      />
                                      <Button
                                        onClick={() => {
                                          const input = document.getElementById(`balance-${selectedUser.id}`) as HTMLInputElement;
                                          const newBalance = parseInt(input.value);
                                          if (!isNaN(newBalance)) {
                                            updateUserBalance(selectedUser.user_id, newBalance);
                                          }
                                        }}
                                      >
                                        Atualizar Saldo
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};