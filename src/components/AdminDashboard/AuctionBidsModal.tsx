import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, User, TrendingUp, Clock, DollarSign, Gavel } from 'lucide-react';

interface Bid {
  id: string;
  bid_amount: number;
  cost_paid: number;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    email: string;
    is_bot: boolean;
  };
}

interface AuctionBidsModalProps {
  isOpen: boolean;
  onClose: () => void;
  auction: any;
}

export const AuctionBidsModal: React.FC<AuctionBidsModalProps> = ({
  isOpen,
  onClose,
  auction
}) => {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalBids: 0,
    userBids: 0,
    botBids: 0,
    totalRevenue: 0,
    averageBidTime: 0
  });

  const fetchBids = async () => {
    if (!auction?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          id,
          bid_amount,
          cost_paid,
          created_at,
          user_id
        `)
        .eq('auction_id', auction.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately to avoid relation issues
      const enrichedBids = await Promise.all(
        (data || []).map(async (bid) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, email, is_bot')
            .eq('user_id', bid.user_id)
            .single();

          return {
            ...bid,
            profiles: profileData || { full_name: '', email: '', is_bot: false }
          };
        })
      );

      setBids(enrichedBids);
      
      // Calculate statistics
      const totalBids = enrichedBids?.length || 0;
      const userBids = enrichedBids?.filter(bid => !bid.profiles?.is_bot).length || 0;
      const botBids = enrichedBids?.filter(bid => bid.profiles?.is_bot).length || 0;
      const totalRevenue = enrichedBids?.reduce((sum, bid) => sum + (bid.cost_paid / 100), 0) || 0;

      setStats({
        totalBids,
        userBids,
        botBids,
        totalRevenue,
        averageBidTime: 0 // Placeholder for now
      });

    } catch (error) {
      console.error('Error fetching bids:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && auction?.id) {
      fetchBids();
    }
  }, [isOpen, auction?.id]);

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  };

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  const getBidderName = (bid: Bid) => {
    if (bid.profiles?.is_bot) {
      return `Bot (${bid.profiles.full_name || 'Sistema'})`;
    }
    return bid.profiles?.full_name || `Usuário ${bid.user_id.slice(0, 8)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Detalhes Completos: {auction?.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total de Lances</p>
                    <p className="text-lg font-bold">{stats.totalBids}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lances de Usuários</p>
                    <p className="text-lg font-bold text-green-600">{stats.userBids}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lances de Bots</p>
                    <p className="text-lg font-bold text-orange-600">{stats.botBids}</p>
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
                    <p className="text-lg font-bold text-primary">{formatPrice(stats.totalRevenue * 100)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Auction Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Preço Atual</p>
              <p className="font-semibold">{formatPrice(auction?.current_price || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={auction?.status === 'active' ? 'default' : 'secondary'}>
                {auction?.status === 'active' ? 'Ativo' : 'Finalizado'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Meta de Receita</p>
              <p className="font-semibold">{formatPrice(auction?.revenue_target || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor de Mercado</p>
              <p className="font-semibold">{formatPrice(auction?.market_value || 0)}</p>
            </div>
          </div>

          {/* Bids Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico Completo de Lances</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário/Bot</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor do Lance</TableHead>
                        <TableHead>Custo Pago</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bids.map((bid, index) => (
                        <TableRow key={bid.id} className={index === 0 ? 'bg-primary/5' : ''}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {bid.profiles?.is_bot ? (
                                <Bot className="h-4 w-4 text-orange-500" />
                              ) : (
                                <User className="h-4 w-4 text-green-500" />
                              )}
                              {getBidderName(bid)}
                              {index === 0 && (
                                <Badge variant="default" className="text-xs">
                                  Último Lance
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={bid.profiles?.is_bot ? 'destructive' : 'default'}
                              className="text-xs"
                            >
                              {bid.profiles?.is_bot ? 'Bot' : 'Usuário'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatPrice(bid.bid_amount)}
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">
                            {formatPrice(bid.cost_paid)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDateTime(bid.created_at)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {bid.profiles?.email || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {bids.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhum lance encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};