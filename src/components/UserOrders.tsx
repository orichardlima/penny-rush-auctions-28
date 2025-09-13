import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, CreditCard, Truck, CheckCircle, Clock, Upload } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface Order {
  id: string;
  auction_id: string;
  product_name: string;
  final_price: number;
  market_value: number;
  savings: number;
  status: string;
  payment_method?: string;
  tracking_code?: string;
  estimated_delivery?: string;
  created_at: string;
  updated_at: string;
}

export const UserOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .rpc('get_user_orders', { user_uuid: user.id });

      if (error) throw error;
      setOrders(data || []);
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

  const handlePaymentProofUpload = async () => {
    if (!paymentProof || !selectedOrder) return;

    setUploading(true);
    try {
      // Upload payment proof to storage
      const fileExt = paymentProof.name.split('.').pop();
      const fileName = `${selectedOrder.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('auction-images')
        .upload(`payment-proofs/${fileName}`, paymentProof);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('auction-images')
        .getPublicUrl(`payment-proofs/${fileName}`);

      // Update order with payment proof
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_proof_url: publicUrl,
          payment_method: 'PIX',
          status: 'paid'
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso!",
        description: "Comprovante enviado com sucesso!",
      });

      fetchOrders();
      setSelectedOrder(null);
      setPaymentProof(null);
    } catch (error) {
      console.error('Error uploading payment proof:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar comprovante",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
        <p className="text-muted-foreground">Você ainda não ganhou nenhum leilão.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Meus Pedidos</h2>
      
      {orders.map((order) => (
        <Card key={order.id} className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold">{order.product_name}</h3>
              <p className="text-sm text-muted-foreground">
                Pedido #{order.id.slice(0, 8)}
              </p>
            </div>
            <Badge variant={getStatusVariant(order.status)} className="flex items-center gap-1">
              {getStatusIcon(order.status)}
              {getStatusText(order.status)}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Preço Final</Label>
              <p className="font-semibold">{formatPrice(order.final_price)}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Valor de Mercado</Label>
              <p className="font-semibold">{formatPrice(order.market_value)}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Economia</Label>
              <p className="font-semibold text-green-600">{formatPrice(order.savings)}</p>
            </div>
          </div>

          {order.tracking_code && (
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground">Código de Rastreamento</Label>
              <p className="font-mono text-sm">{order.tracking_code}</p>
            </div>
          )}

          {order.status === 'awaiting_payment' && (
            <Dialog>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedOrder(order)}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Enviar Comprovante
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Comprovante de Pagamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Produto: {order.product_name}</Label>
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(order.final_price)}
                    </p>
                  </div>
                  
                  <div>
                    <Label>Dados PIX para Pagamento:</Label>
                    <div className="bg-muted p-4 rounded-lg">
                      <p><strong>Chave PIX:</strong> contato@pennyauctions.com</p>
                      <p><strong>Valor:</strong> {formatPrice(order.final_price)}</p>
                      <p><strong>Favorecido:</strong> Penny Auctions</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="payment-proof">Comprovante de Pagamento</Label>
                    <Input
                      id="payment-proof"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                    />
                  </div>

                  <Button 
                    onClick={handlePaymentProofUpload}
                    disabled={!paymentProof || uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Enviar Comprovante
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </Card>
      ))}
    </div>
  );
};