import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, ShoppingCart, CheckCircle } from 'lucide-react';

interface UserPurchaseHistoryModalProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PurchaseRecord {
  id: string;
  created_at: string;
  bids_purchased: number;
  amount_paid: number;
  payment_status: string | null;
  payment_id: string | null;
  package_name: string;
}

interface PurchaseSummary {
  totalPurchases: number;
  totalBidsPurchased: number;
  totalAmountPaid: number;
  approvedPurchases: number;
}

const ITEMS_PER_PAGE = 15;

export const UserPurchaseHistoryModal: React.FC<UserPurchaseHistoryModalProps> = ({
  userId,
  userName,
  isOpen,
  onClose
}) => {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [summary, setSummary] = useState<PurchaseSummary>({ 
    totalPurchases: 0, 
    totalBidsPurchased: 0, 
    totalAmountPaid: 0, 
    approvedPurchases: 0 
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchPurchaseHistory = async () => {
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

      // Fetch purchases with package info
      let query = supabase
        .from('bid_purchases')
        .select(`
          id,
          created_at,
          bids_purchased,
          amount_paid,
          payment_status,
          payment_id,
          bid_packages!inner(
            name
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('payment_status', statusFilter);
      }

      const { data: allPurchases, error } = await query;

      if (error) throw error;

      // Transform data
      const transformedPurchases: PurchaseRecord[] = (allPurchases || []).map((purchase: any) => ({
        id: purchase.id,
        created_at: purchase.created_at,
        bids_purchased: purchase.bids_purchased,
        amount_paid: purchase.amount_paid,
        payment_status: purchase.payment_status,
        payment_id: purchase.payment_id,
        package_name: purchase.bid_packages.name
      }));

      // Calculate summary (only for approved purchases for totals)
      const approvedPurchases = transformedPurchases.filter(p => p.payment_status === 'completed');
      
      setSummary({
        totalPurchases: transformedPurchases.length,
        totalBidsPurchased: approvedPurchases.reduce((sum, p) => sum + p.bids_purchased, 0),
        totalAmountPaid: approvedPurchases.reduce((sum, p) => sum + Number(p.amount_paid), 0),
        approvedPurchases: approvedPurchases.length
      });

      // Paginate
      setTotalPages(Math.ceil(transformedPurchases.length / ITEMS_PER_PAGE) || 1);
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedPurchases = transformedPurchases.slice(startIndex, startIndex + ITEMS_PER_PAGE);
      
      setPurchases(paginatedPurchases);
    } catch (error) {
      console.error('Error fetching purchase history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      setCurrentPage(1);
      fetchPurchaseHistory();
    }
  }, [isOpen, userId, periodFilter, statusFilter]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchPurchaseHistory();
    }
  }, [currentPage]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string | null) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'completed': { label: 'Aprovado', variant: 'default' },
      'pending': { label: 'Pendente', variant: 'outline' },
      'failed': { label: 'Rejeitado', variant: 'destructive' },
      'cancelled': { label: 'Cancelado', variant: 'secondary' }
    };
    const config = statusConfig[status || 'pending'] || { label: status || 'Desconhecido', variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Histórico de Compras - {userName}
          </DialogTitle>
          <DialogDescription>
            Visualize todas as compras de pacotes de lances deste usuário
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{summary.totalPurchases}</p>
              <p className="text-xs text-muted-foreground">Total de Compras</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.totalBidsPurchased}</p>
              <p className="text-xs text-muted-foreground">Lances Adquiridos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalAmountPaid)}</p>
              <p className="text-xs text-muted-foreground">Total Pago</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                <CheckCircle className="h-5 w-5" />
                {summary.approvedPurchases}
              </p>
              <p className="text-xs text-muted-foreground">Aprovados</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="completed">Aprovados</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="failed">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma compra encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead className="text-center">Lances</TableHead>
                  <TableHead className="text-right">Valor Pago</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(purchase.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{purchase.package_name}</span>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {purchase.bids_purchased}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(purchase.amount_paid)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(purchase.payment_status)}
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
