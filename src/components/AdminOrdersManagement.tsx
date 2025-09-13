import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, Eye, Edit, Calendar, Truck, CheckCircle, Clock, CreditCard, ExternalLink } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Order {
  id: string;
  auction_id: string;
  winner_id: string;
  product_name: string;
  final_price: number;
  market_value: number;
  status: string;
  payment_method?: string;
  payment_proof_url?: string;
  delivery_address?: any;
  tracking_code?: string;
  estimated_delivery?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  winner_name?: string;
  winner_email?: string;
}

export const AdminOrdersManagement = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [updateData, setUpdateData] = useState<Partial<Order>>({});
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      // First get orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Then get profiles for the winners
      const winnerIds = ordersData?.map(order => order.winner_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', winnerIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const ordersWithUserInfo = ordersData?.map(order => {
        const profile = profilesData?.find(p => p.user_id === order.winner_id);
        return {
          ...order,
          winner_name: profile?.full_name,
          winner_email: profile?.email
        };
      }) || [];

      setOrders(ordersWithUserInfo);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pedidos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrder = async () => {
    if (!editingOrder) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', editingOrder.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Pedido atualizado com sucesso!",
      });

      fetchOrders();
      setEditingOrder(null);
      setUpdateData({});
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar pedido",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'awaiting_payment':
        return <Clock className="w-4 h-4" />;
      case 'paid':
        return <CreditCard className="w-4 h-4" />;
      case 'shipped':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'awaiting_payment':
        return 'Aguardando Pagamento';
      case 'paid':
        return 'Pago';
      case 'shipped':
        return 'Enviado';
      case 'delivered':
        return 'Entregue';
      default:
        return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'awaiting_payment':
        return 'destructive';
      case 'paid':
        return 'secondary';
      case 'shipped':
        return 'outline';
      case 'delivered':
        return 'default';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciar Pedidos</h2>
        <Button onClick={fetchOrders} variant="outline">
          Atualizar
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Vencedor</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-sm">
                  #{order.id.slice(0, 8)}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{order.winner_name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{order.winner_email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{order.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Economia: {formatPrice(order.market_value - order.final_price)}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="font-semibold">{formatPrice(order.final_price)}</p>
                  <p className="text-xs text-muted-foreground line-through">
                    {formatPrice(order.market_value)}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(order.status)} className="flex items-center gap-1 w-fit">
                    {getStatusIcon(order.status)}
                    {getStatusText(order.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(order.created_at), 'dd/MM/yy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Detalhes do Pedido #{order.id.slice(0, 8)}</DialogTitle>
                        </DialogHeader>
                        {selectedOrder && selectedOrder.id === order.id && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-muted-foreground">Produto</Label>
                                <p className="font-semibold">{order.product_name}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Vencedor</Label>
                                <p>{order.winner_name}</p>
                                <p className="text-xs text-muted-foreground">{order.winner_email}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Preço Final</Label>
                                <p className="font-semibold">{formatPrice(order.final_price)}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Valor de Mercado</Label>
                                <p>{formatPrice(order.market_value)}</p>
                              </div>
                            </div>

                            {order.payment_proof_url && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Comprovante de Pagamento</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Button size="sm" variant="outline" asChild>
                                    <a 
                                      href={order.payment_proof_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Ver Comprovante
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            )}

                            {order.tracking_code && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Código de Rastreamento</Label>
                                <p className="font-mono">{order.tracking_code}</p>
                              </div>
                            )}

                            {order.notes && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Observações</Label>
                                <p className="text-sm">{order.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setEditingOrder(order);
                            setUpdateData({
                              status: order.status,
                              tracking_code: order.tracking_code || '',
                              estimated_delivery: order.estimated_delivery || '',
                              notes: order.notes || ''
                            });
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Pedido #{order.id.slice(0, 8)}</DialogTitle>
                        </DialogHeader>
                        {editingOrder && editingOrder.id === order.id && (
                          <div className="space-y-4">
                            <div>
                              <Label>Status</Label>
                              <Select 
                                value={updateData.status} 
                                onValueChange={(value) => setUpdateData(prev => ({ ...prev, status: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="awaiting_payment">Aguardando Pagamento</SelectItem>
                                  <SelectItem value="paid">Pago</SelectItem>
                                  <SelectItem value="shipped">Enviado</SelectItem>
                                  <SelectItem value="delivered">Entregue</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>Código de Rastreamento</Label>
                              <Input
                                value={updateData.tracking_code || ''}
                                onChange={(e) => setUpdateData(prev => ({ ...prev, tracking_code: e.target.value }))}
                                placeholder="Ex: BR123456789"
                              />
                            </div>

                            <div>
                              <Label>Data Prevista de Entrega</Label>
                              <Input
                                type="date"
                                value={updateData.estimated_delivery || ''}
                                onChange={(e) => setUpdateData(prev => ({ ...prev, estimated_delivery: e.target.value }))}
                              />
                            </div>

                            <div>
                              <Label>Observações</Label>
                              <Textarea
                                value={updateData.notes || ''}
                                onChange={(e) => setUpdateData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Observações sobre o pedido..."
                              />
                            </div>

                            <Button onClick={updateOrder} disabled={updating} className="w-full">
                              {updating ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Atualizando...
                                </>
                              ) : (
                                'Atualizar Pedido'
                              )}
                            </Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {orders.length === 0 && (
          <div className="text-center p-8">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground">Ainda não há pedidos para gerenciar.</p>
          </div>
        )}
      </Card>
    </div>
  );
};