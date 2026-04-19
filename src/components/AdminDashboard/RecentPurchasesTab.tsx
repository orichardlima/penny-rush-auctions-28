import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, DollarSign, Package, ChevronLeft, ChevronRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfirmPendingPurchaseDialog from '@/components/Admin/ConfirmPendingPurchaseDialog';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'completed' | 'pending' | 'failed';
type PeriodFilter = '7d' | '30d' | '90d' | 'all';

interface PurchaseRow {
  id: string;
  amount_paid: number;
  bids_purchased: number;
  payment_status: string | null;
  created_at: string;
  user_id: string;
  userName: string;
  bid_packages: { name: string } | null;
}

interface Summary {
  totalPurchases: number;
  totalRevenue: number;
  totalBidsSold: number;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  completed: { label: 'Aprovado', variant: 'default' },
  pending: { label: 'Pendente', variant: 'secondary' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

function getDateFilter(period: PeriodFilter): string | null {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const RecentPurchasesTab: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalPurchases: 0, totalRevenue: 0, totalBidsSold: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d');
  const [confirmTarget, setConfirmTarget] = useState<PurchaseRow | null>(null);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bid_purchases')
        .select('id, amount_paid, bids_purchased, payment_status, created_at, user_id, bid_packages(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const dateFrom = getDateFilter(periodFilter);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (statusFilter !== 'all') query = query.eq('payment_status', statusFilter);

      const { data, count, error } = await query;
      if (error) throw error;

      const rows = (data || []) as unknown as Array<{
        id: string; amount_paid: number; bids_purchased: number;
        payment_status: string | null; created_at: string; user_id: string;
        bid_packages: { name: string } | null;
      }>;

      // Fetch user names separately
      const userIds = [...new Set(rows.map(r => r.user_id))];
      const nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || 'Desconhecido'; });
      }

      setPurchases(rows.map(r => ({ ...r, userName: nameMap[r.user_id] || 'Desconhecido' })));
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Erro ao buscar compras:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, periodFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      let query = supabase
        .from('bid_purchases')
        .select('amount_paid, bids_purchased, payment_status');

      const dateFrom = getDateFilter(periodFilter);
      if (dateFrom) query = query.gte('created_at', dateFrom);

      const { data, error } = await query;
      if (error) throw error;

      const completed = (data || []).filter(d => d.payment_status === 'completed');
      setSummary({
        totalPurchases: (data || []).length,
        totalRevenue: completed.reduce((s, d) => s + (d.amount_paid || 0), 0),
        totalBidsSold: completed.reduce((s, d) => s + (d.bids_purchased || 0), 0),
      });
    } catch (err) {
      console.error('Erro ao buscar resumo:', err);
    }
  }, [periodFilter]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, periodFilter]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Compras de Lances</h2>
          <p className="text-muted-foreground">Visão consolidada de todas as compras da plataforma</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchPurchases(); fetchSummary(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Compras</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalPurchases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita (Aprovadas)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ {summary.totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lances Vendidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.totalBidsSold}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 3 meses</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="completed">Aprovado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhuma compra encontrada</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead className="text-right">Lances</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => {
                  const cfg = statusConfig[p.payment_status || 'pending'] || statusConfig.pending;
                  const isPending = p.payment_status === 'pending';
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(p.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{p.userName}</TableCell>
                      <TableCell>{p.bid_packages?.name || '—'}</TableCell>
                      <TableCell className="text-right">{p.bids_purchased}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">R$ {p.amount_paid.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isPending && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmTarget(p)}
                            className="whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Confirmar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages} ({totalCount} registros)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecentPurchasesTab;
