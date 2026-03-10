import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, ChevronLeft, ChevronRight, RefreshCw, Package } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PurchaseItem {
  id: string;
  created_at: string;
  purchase_amount: number;
  commission_amount: number;
  commission_rate: number;
  is_repurchase: boolean;
  status: string;
  referred_user_name: string;
  package_name: string;
  bids_purchased: number;
}

interface AffiliatePurchaseHistoryProps {
  affiliateId: string;
}

export function AffiliatePurchaseHistory({ affiliateId }: AffiliatePurchaseHistoryProps) {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const perPage = 10;

  useEffect(() => {
    fetchPurchases();
  }, [affiliateId, page]);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      const { data: commissions, error, count } = await supabase
        .from('affiliate_commissions')
        .select('*', { count: 'exact' })
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setTotalCount(count || 0);

      const purchasesWithDetails: PurchaseItem[] = await Promise.all(
        (commissions || []).map(async (comm) => {
          // Get referred user name
          let userName = 'Usuário';
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', comm.referred_user_id)
            .single();
          if (profileData?.full_name) userName = profileData.full_name;

          // Get package info from bid_purchases
          let packageName = 'Pacote';
          let bidsPurchased = 0;
          const { data: purchaseData } = await supabase
            .from('bid_purchases')
            .select('bids_purchased, package_id')
            .eq('id', comm.purchase_id)
            .single();

          if (purchaseData) {
            bidsPurchased = purchaseData.bids_purchased;
            const { data: packageData } = await supabase
              .from('bid_packages')
              .select('name')
              .eq('id', purchaseData.package_id)
              .single();
            if (packageData?.name) packageName = packageData.name;
          }

          return {
            id: comm.id,
            created_at: comm.created_at,
            purchase_amount: comm.purchase_amount,
            commission_amount: comm.commission_amount,
            commission_rate: comm.commission_rate,
            is_repurchase: comm.is_repurchase,
            status: comm.status,
            referred_user_name: userName,
            package_name: packageName,
            bids_purchased: bidsPurchased,
          };
        })
      );

      setPurchases(purchasesWithDetails);
    } catch (error) {
      console.error('Error fetching purchase history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Aprovada</Badge>;
      case 'paid':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Paga</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pendente</Badge>;
      case 'cancelled':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Histórico de Compras dos Indicados
        </CardTitle>
        <CardDescription>
          Todas as compras realizadas pelos seus indicados e suas comissões
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma compra registrada ainda</p>
            <p className="text-sm mt-1">Quando seus indicados realizarem compras, elas aparecerão aqui.</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicado</TableHead>
                    <TableHead>Pacote</TableHead>
                    <TableHead>Lances</TableHead>
                    <TableHead>Valor da Compra</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.referred_user_name}</TableCell>
                      <TableCell>{item.package_name}</TableCell>
                      <TableCell>{item.bids_purchased}</TableCell>
                      <TableCell>{formatPrice(item.purchase_amount)}</TableCell>
                      <TableCell>
                        {item.is_repurchase ? (
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Recompra
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            1ª Compra
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.commission_rate}%</TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        {formatPrice(item.commission_amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((page - 1) * perPage) + 1} a {Math.min(page * perPage, totalCount)} de {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
