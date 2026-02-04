import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, QrCode, Check, Clock, RefreshCw, Wallet, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PartnerPixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  paymentData: {
    paymentId: string;
    qrCode?: string;
    qrCodeBase64?: string;
    pixCopyPaste?: string;
  };
  planInfo: {
    name: string;
    aporteValue: number;
    bonusBids: number;
  };
  contractId: string;
  onSuccess: () => void;
  isUpgrade?: boolean;
}

export const PartnerPixPaymentModal = ({ 
  open, 
  onClose, 
  paymentData, 
  planInfo,
  contractId,
  onSuccess,
  isUpgrade = false
}: PartnerPixPaymentModalProps) => {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'failed'>('pending');
  const { toast } = useToast();

  // Real-time payment detection
  useEffect(() => {
    if (!open || !contractId || paymentStatus !== 'pending') return;

    console.log('🔗 Setting up realtime subscription for partner contract:', contractId);

    const channel = supabase
      .channel(`partner-payment-status-${contractId}`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'partner_contracts',
          filter: `id=eq.${contractId}`
        },
        (payload) => {
          console.log('💰 Partner contract status updated via realtime:', payload);
          
          const newPaymentStatus = payload.new?.payment_status;
          const newStatus = payload.new?.status;
          const oldPaymentStatus = payload.old?.payment_status;
          
          console.log(`Status change: ${oldPaymentStatus} -> ${newPaymentStatus}, contract status: ${newStatus}`);
          
          if (newPaymentStatus === 'completed' && oldPaymentStatus === 'pending') {
            console.log('✅ Payment approved! Updating UI...');
            setPaymentStatus('approved');
            toast({
              title: "Pagamento aprovado! 🎉",
              description: "Seu contrato de parceiro foi ativado com sucesso.",
              variant: "default"
            });
            
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 2000);
          } else if (newPaymentStatus === 'failed') {
            setPaymentStatus('failed');
            toast({
              title: "Pagamento rejeitado",
              description: "Tente novamente ou use outro método.",
              variant: "destructive"
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to partner payment updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error');
        }
      });

    // Polling de backup a cada 3 segundos
    const pollingInterval = setInterval(async () => {
      if (paymentStatus !== 'pending') {
        clearInterval(pollingInterval);
        return;
      }

      try {
        console.log('🔍 Polling partner contract status...');
        const { data, error } = await supabase
          .from('partner_contracts')
          .select('payment_status, status')
          .eq('id', contractId)
          .single();

        if (error) {
          console.error('Polling error:', error);
          return;
        }

        if (data.payment_status === 'completed') {
          console.log('✅ Payment completed detected via polling!');
          setPaymentStatus('approved');
          toast({
            title: "Pagamento aprovado! 🎉",
            description: "Seu contrato de parceiro foi ativado com sucesso.",
            variant: "default"
          });
          
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        } else if (data.payment_status === 'failed') {
          setPaymentStatus('failed');
          toast({
            title: "Pagamento rejeitado",
            description: "Tente novamente ou use outro método.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    // Timeout de segurança (30 minutos)
    const timeoutId = setTimeout(() => {
      console.log('⏰ Payment timeout reached');
      toast({
        title: "Tempo limite excedido",
        description: "Use o botão 'Já fiz o pagamento' se o pagamento foi efetuado.",
        variant: "default"
      });
    }, 30 * 60 * 1000);

    return () => {
      console.log('🔌 Cleaning up realtime subscription and polling');
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
      clearTimeout(timeoutId);
    };
  }, [open, contractId, paymentStatus, onSuccess, onClose, toast]);

  const copyToClipboard = () => {
    if (paymentData.pixCopyPaste) {
      navigator.clipboard.writeText(paymentData.pixCopyPaste);
      setCopied(true);
      toast({
        title: "Código PIX copiado!",
        description: "Cole no seu banco para fazer o pagamento.",
        variant: "default"
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const checkPaymentStatus = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase
        .from('partner_contracts')
        .select('payment_status, status')
        .eq('id', contractId)
        .single();

      if (error) {
        console.error('Error checking payment:', error);
        return;
      }

      if (data.payment_status === 'completed') {
        setPaymentStatus('approved');
        toast({
          title: "Pagamento aprovado! 🎉",
          description: "Seu contrato de parceiro foi ativado com sucesso.",
          variant: "default"
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else if (data.payment_status === 'failed') {
        setPaymentStatus('failed');
        toast({
          title: "Pagamento rejeitado",
          description: "Tente novamente ou use outro método.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Pagamento ainda pendente",
          description: "Aguarde a confirmação do seu banco.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setChecking(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isUpgrade ? 'Pagamento PIX - Upgrade de Plano' : 'Pagamento PIX - Parceria'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan Info */}
          <Card className="p-4">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">{planInfo.name}</h3>
              </div>
              <p className="text-2xl font-bold text-primary">{formatPrice(planInfo.aporteValue)}</p>
              <div className="space-y-1">
                <Badge variant="secondary" className="text-xs">
                  {isUpgrade ? 'Diferença para upgrade' : 'Aporte para participação'}
                </Badge>
                {planInfo.bonusBids > 0 && (
                  <div className="flex items-center justify-center gap-1 text-xs text-amber-600">
                    <Zap className="h-3 w-3" />
                    <span>+{planInfo.bonusBids} lances de bônus</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Payment Status */}
          {paymentStatus === 'pending' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-orange-600">
                <Clock className="w-5 h-5" />
                <span>Aguardando pagamento</span>
              </div>
              
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                💡 O pagamento será detectado automaticamente
              </div>
              
              {/* QR Code */}
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

              {/* PIX Copy/Paste */}
              {paymentData.pixCopyPaste && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Ou copie o código PIX
                  </p>
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    className="w-full"
                    disabled={copied}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar código PIX
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Check Payment Button */}
              <Button
                onClick={checkPaymentStatus}
                disabled={checking}
                className="w-full"
              >
                {checking ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Já fiz o pagamento'
                )}
              </Button>
            </div>
          )}

          {paymentStatus === 'approved' && (
            <div className="text-center space-y-4">
              <div className="text-green-600">
                <Check className="w-12 h-12 mx-auto mb-2" />
                <p className="font-semibold">Pagamento aprovado!</p>
                <p className="text-sm">
                  {isUpgrade 
                    ? 'Seu plano foi atualizado com sucesso.' 
                    : 'Seu contrato de parceiro foi ativado.'
                  }
                </p>
                {planInfo.bonusBids > 0 && (
                  <p className="text-sm text-amber-600">
                    +{planInfo.bonusBids} lances foram creditados!
                  </p>
                )}
              </div>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="text-center space-y-4">
              <div className="text-red-600">
                <p className="font-semibold">Pagamento não aprovado</p>
                <p className="text-sm">Tente novamente ou entre em contato conosco.</p>
              </div>
              <Button onClick={onClose} variant="outline" className="w-full">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
