import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Trophy, Search, Loader2, Gavel } from 'lucide-react';

interface UserBidHistoryModalProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface BidRecord {
  id: string;
  created_at: string;
  bid_amount: number;
  cost_paid: number;
  auction_id: string;
  auction_title: string;
  auction_image: string | null;
  auction_status: string;
  is_winner: boolean;
}

interface BidSummary {
  totalBids: number;
  totalSpent: number;
  uniqueAuctions: number;
  auctionsWon: number;
}

const ITEMS_PER_PAGE = 15;

export const UserBidHistoryModal: React.FC<UserBidHistoryModalProps> = ({
  userId,
  userName,
  isOpen,
  onClose
}) => {
  const [bids, setBids] = useState<BidRecord[]>([]);
  const [summary, setSummary] = useState<BidSummary>({ totalBids: 0, totalSpent: 0, uniqueAuctions: 0, auctionsWon: 0 });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBidHistory = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Build date filter
      let dateFilter = null;
      const now = new Date();
      if (periodFilter === '7days') {
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (periodFilter === '30days') {
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (periodFilter === '90days') {
        dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      }

      // Fetch bids with auction info
      let query = supabase
        .from('bids')
        .select(`
          id,
          created_at,
          bid_amount,
          cost_paid,
          auction_id,
          auctions!inner(
            title,
            image_url,
            status,
            winner_id
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data: allBids, error } = await query;

      if (error) throw error;

      // Transform and filter data
      let transformedBids: BidRecord[] = (allBids || []).map((bid: any) => ({
        id: bid.id,
        created_at: bid.created_at,
        bid_amount: bid.bid_amount,
        cost_paid: bid.cost_paid,
        auction_id: bid.auction_id,
        auction_title: bid.auctions.title,
        auction_image: bid.auctions.image_url,
        auction_status: bid.auctions.status,
        is_winner: bid.auctions.winner_id === userId
      }));

      // Apply search filter
      if (searchQuery.trim()) {
        const search = searchQuery.toLowerCase();
        transformedBids = transformedBids.filter(bid => 
          bid.auction_title.toLowerCase().includes(search)
        );
      }

      // Calculate summary
      const uniqueAuctionIds = new Set(transformedBids.map(b => b.auction_id));
      const wonAuctions = new Set(transformedBids.filter(b => b.is_winner).map(b => b.auction_id));
      
      setSummary({
        totalBids: transformedBids.length,
        totalSpent: transformedBids.reduce((sum, b) => sum + Number(b.cost_paid), 0),
        uniqueAuctions: uniqueAuctionIds.size,
        auctionsWon: wonAuctions.size
      });

      // Paginate
      setTotalPages(Math.ceil(transformedBids.length / ITEMS_PER_PAGE) || 1);
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedBids = transformedBids.slice(startIndex, startIndex + ITEMS_PER_PAGE);
      
      setBids(paginatedBids);
    } catch (error) {
      console.error('Error fetching bid history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      setCurrentPage(1);
      fetchBidHistory();
    }
  }, [isOpen, userId, periodFilter, searchQuery]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchBidHistory();
    }
  }, [currentPage]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'active': { label: 'Ativo', variant: 'default' },
      'finished': { label: 'Finalizado', variant: 'secondary' },
      'waiting': { label: 'Aguardando', variant: 'outline' },
      'cancelled': { label: 'Cancelado', variant: 'destructive' }
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Histórico de Lances - {userName}
          </DialogTitle>
          <DialogDescription>
            Visualize todos os lances realizados por este usuário
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{summary.totalBids}</p>
              <p className="text-xs text-muted-foreground">Total de Lances</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalSpent)}</p>
              <p className="text-xs text-muted-foreground">Total Gasto</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.uniqueAuctions}</p>
              <p className="text-xs text-muted-foreground">Leilões Participados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{summary.auctionsWon}</p>
              <p className="text-xs text-muted-foreground">Leilões Ganhos</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por produto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os períodos</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="90days">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : bids.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gavel className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum lance encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor do Lance</TableHead>
                  <TableHead className="text-right">Custo Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.map((bid) => (
                  <TableRow 
                    key={bid.id}
                    className={bid.is_winner ? 'bg-green-50 dark:bg-green-950/20' : ''}
                  >
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(bid.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {bid.is_winner && (
                          <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[200px]" title={bid.auction_title}>
                          {bid.auction_title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(bid.auction_status)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(bid.bid_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(bid.cost_paid)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
