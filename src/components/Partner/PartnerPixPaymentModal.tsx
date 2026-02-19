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
  intentId?: string;
  contractId?: string;
  onSuccess: () => void;
  isUpgrade?: boolean;
  previousPlanName?: string;
}

export const PartnerPixPaymentModal = ({ 
  open, 
  onClose, 
  paymentData, 
  planInfo,
  intentId,
  contractId,
  onSuccess,
  isUpgrade = false,
  previousPlanName
}: PartnerPixPaymentModalProps) => {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'failed'>('pending');
  const { toast } = useToast();

  // Real-time payment detection
  useEffect(() => {
    if (!open || paymentStatus !== 'pending') return;

    // For upgrades, we monitor the existing contract
    // For new contracts, we monitor partner_contracts for a new ACTIVE contract created by webhook
    const userId = intentId || contractId;
    if (!userId) return;

    console.log('🔗 Setting up realtime subscription. Mode:', isUpgrade ? 'UPGRADE' : 'NEW (via intent)');

    const channels: any[] = [];

    if (isUpgrade && contractId) {
      // UPGRADE: monitor contract for plan change
      const channel = supabase
        .channel(`partner-upgrade-${contractId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'partner_contracts',
            filter: `id=eq.${contractId}`
          },
          (payload) => {
            console.log('💰 Contract updated (upgrade):', payload);
            const newPlanName = payload.new?.plan_name;
            const oldPlanName = payload.old?.plan_name;
            
            if (previousPlanName && newPlanName === planInfo.name && oldPlanName === previousPlanName) {
              handleApproved('Seu plano foi atualizado com sucesso.');
            }
          }
        )
        .subscribe();
      channels.push(channel);
    } else {
      // NEW CONTRACT: monitor partner_contracts for INSERT of new ACTIVE contract
      // We poll since realtime INSERT filter by user_id isn't straightforward
      console.log('📋 Will use polling to detect new contract creation from intent:', intentId);
    }

    // Polling de backup a cada 3 segundos
    const pollingInterval = setInterval(async () => {
      if (paymentStatus !== 'pending') {
        clearInterval(pollingInterval);
        return;
      }

      try {
        if (isUpgrade && contractId) {
          // UPGRADE: check if plan changed
          const { data, error } = await supabase
            .from('partner_contracts')
            .select('plan_name')
            .eq('id', contractId)
            .single();

          if (!error && data && previousPlanName && data.plan_name !== previousPlanName) {
            console.log('✅ Upgrade detected via polling');
            handleApproved('Seu plano foi atualizado com sucesso.');
          }
        } else if (intentId) {
          // NEW CONTRACT: check if a contract was created for this user
          // First check the intent status
          const { data: intentData } = await supabase
            .from('partner_payment_intents')
            .select('payment_status, user_id')
            .eq('id', intentId)
            .single();

          if (intentData?.payment_status === 'approved') {
            console.log('✅ Intent approved, checking for contract...');
            // Verify contract exists
            const { data: newContract } = await supabase
              .from('partner_contracts')
              .select('id, status')
              .eq('user_id', intentData.user_id)
              .eq('status', 'ACTIVE')
              .maybeSingle();

            if (newContract) {
              console.log('✅ New ACTIVE contract found:', newContract.id);
              handleApproved('Seu contrato de parceiro foi ativado com sucesso.');
            }
          } else if (intentData?.payment_status === 'rejected' || intentData?.payment_status === 'expired') {
            setPaymentStatus('failed');
            toast({
              title: "Pagamento rejeitado",
              description: "Tente novamente ou use outro método.",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    // Timeout de segurança (30 minutos)
    const timeoutId = setTimeout(() => {
      toast({
        title: "Tempo limite excedido",
        description: "Use o botão 'Já fiz o pagamento' se o pagamento foi efetuado.",
        variant: "default"
      });
    }, 30 * 60 * 1000);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      clearInterval(pollingInterval);
      clearTimeout(timeoutId);
    };
  }, [open, intentId, contractId, paymentStatus, onSuccess, onClose, toast, isUpgrade, previousPlanName, planInfo.name]);

  const handleApproved = (message: string) => {
    setPaymentStatus('approved');
    toast({
      title: "Pagamento aprovado! 🎉",
      description: message,
      variant: "default"
    });
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 2000);
  };

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
      if (isUpgrade && contractId) {
        const { data } = await supabase
          .from('partner_contracts')
          .select('plan_name')
          .eq('id', contractId)
          .single();

        if (data && previousPlanName && data.plan_name !== previousPlanName) {
          handleApproved('Seu plano foi atualizado com sucesso.');
        } else {
          toast({ title: "Pagamento ainda pendente", description: "Aguarde a confirmação do seu banco.", variant: "default" });
        }
      } else if (intentId) {
        const { data: intentData } = await supabase
          .from('partner_payment_intents')
          .select('payment_status, user_id')
          .eq('id', intentId)
          .single();

        if (intentData?.payment_status === 'approved') {
          handleApproved('Seu contrato de parceiro foi ativado com sucesso.');
        } else if (intentData?.payment_status === 'rejected' || intentData?.payment_status === 'expired') {
          setPaymentStatus('failed');
          toast({ title: "Pagamento rejeitado", description: "Tente novamente.", variant: "destructive" });
        } else {
          toast({ title: "Pagamento ainda pendente", description: "Aguarde a confirmação do seu banco.", variant: "default" });
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setChecking(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
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