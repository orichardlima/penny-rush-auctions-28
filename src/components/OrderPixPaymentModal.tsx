import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, QrCode, Check, Clock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/utils";

interface OrderPixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  paymentData: {
    paymentId: string;
    qrCode?: string;
    qrCodeBase64?: string;
    pixCopyPaste?: string;
  };
  orderInfo: {
    productName: string;
    finalPrice: number;
  };
  orderId: string;
  onSuccess: () => void;
}

export const OrderPixPaymentModal = ({
  open,
  onClose,
  paymentData,
  orderInfo,
  orderId,
  onSuccess
}: OrderPixPaymentModalProps) => {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'failed'>('pending');
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !orderId || paymentStatus !== 'pending') return;

    const channel = supabase
      .channel(`order-payment-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          if (payload.new?.status === 'paid') {
            setPaymentStatus('approved');
            toast({
              title: "Pagamento aprovado! 🎉",
              description: "Seu pedido foi confirmado.",
            });
            setTimeout(() => { onSuccess(); onClose(); }, 2000);
          }
        }
      )
      .subscribe();

    const pollingInterval = setInterval(async () => {
      if (paymentStatus !== 'pending') { clearInterval(pollingInterval); return; }
      try {
        const { data } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .single();
        if (data?.status === 'paid') {
          setPaymentStatus('approved');
          toast({ title: "Pagamento aprovado! 🎉", description: "Seu pedido foi confirmado." });
          setTimeout(() => { onSuccess(); onClose(); }, 2000);
        }
      } catch {}
    }, 3000);

    const timeoutId = setTimeout(() => {
      toast({ title: "Tempo limite", description: "Use 'Já fiz o pagamento' se já pagou." });
    }, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
      clearTimeout(timeoutId);
    };
  }, [open, orderId, paymentStatus, onSuccess, onClose, toast]);

  const copyToClipboard = () => {
    if (paymentData.pixCopyPaste) {
      navigator.clipboard.writeText(paymentData.pixCopyPaste);
      setCopied(true);
      toast({ title: "Código PIX copiado!", description: "Cole no seu banco para pagar." });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const checkPaymentStatus = async () => {
    setChecking(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();
      if (data?.status === 'paid') {
        setPaymentStatus('approved');
        toast({ title: "Pagamento aprovado! 🎉", description: "Seu pedido foi confirmado." });
        setTimeout(() => { onSuccess(); onClose(); }, 2000);
      } else {
        toast({ title: "Pagamento pendente", description: "Ainda não detectamos o pagamento.", variant: "default" });
      }
    } catch {} finally { setChecking(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Pagamento PIX do Produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">{orderInfo.productName}</h3>
              <p className="text-2xl font-bold text-primary">{formatPrice(orderInfo.finalPrice)}</p>
            </div>
          </Card>

          {paymentStatus === 'pending' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-orange-600">
                <Clock className="w-5 h-5" />
                <span>Aguardando pagamento</span>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                💡 O pagamento será detectado automaticamente
              </div>

              {paymentData.qrCodeBase64 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <QrCode className="w-5 h-5" />
                    <span className="font-medium">Escaneie o QR Code</span>
                  </div>
                  <div className="flex justify-center">
                    <img
                      src={`data:image/png;base64,${paymentData.qrCodeBase64}`}
                      alt="QR Code PIX"
                      className="w-48 h-48 border rounded"
                    />
                  </div>
                </div>
              )}

              {paymentData.pixCopyPaste && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Ou copie o código PIX</p>
                  <Button onClick={copyToClipboard} variant="outline" className="w-full" disabled={copied}>
                    {copied ? <><Check className="w-4 h-4 mr-2" />Copiado!</> : <><Copy className="w-4 h-4 mr-2" />Copiar código PIX</>}
                  </Button>
                </div>
              )}

              <Button onClick={checkPaymentStatus} disabled={checking} className="w-full">
                {checking ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Verificando...</> : 'Já fiz o pagamento'}
              </Button>
            </div>
          )}

          {paymentStatus === 'approved' && (
            <div className="text-center space-y-4">
              <div className="text-green-600">
                <Check className="w-12 h-12 mx-auto mb-2" />
                <p className="font-semibold">Pagamento aprovado!</p>
                <p className="text-sm">Seu pedido foi confirmado com sucesso.</p>
              </div>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="text-center space-y-4">
              <div className="text-red-600">
                <p className="font-semibold">Pagamento não aprovado</p>
                <p className="text-sm">Tente novamente ou entre em contato.</p>
              </div>
              <Button onClick={onClose} variant="outline" className="w-full">Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
