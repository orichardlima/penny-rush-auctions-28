import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PendingPurchase {
  id: string;
  userName: string;
  bids_purchased: number;
  amount_paid: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: PendingPurchase | null;
  onConfirmed: () => void;
}

const ConfirmPendingPurchaseDialog: React.FC<Props> = ({ open, onOpenChange, purchase, onConfirmed }) => {
  const { toast } = useToast();
  const [justification, setJustification] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setJustification('');
    setPaymentReference('');
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!purchase) return;
    if (justification.trim().length < 20) {
      toast({ title: 'Justificativa muito curta', description: 'Mínimo de 20 caracteres.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-confirm-pending-purchase', {
        body: {
          purchase_id: purchase.id,
          justification: justification.trim(),
          payment_reference: paymentReference.trim() || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Compra confirmada',
        description: `+${data.bids_credited} lances creditados para ${data.user_name || 'o usuário'}.`,
      });
      reset();
      onOpenChange(false);
      onConfirmed();
    } catch (err: any) {
      toast({
        title: 'Erro ao confirmar',
        description: err?.message || 'Falha desconhecida',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Confirmar compra manualmente
          </DialogTitle>
          <DialogDescription>
            Use esta ação quando o webhook do gateway não chegou mas o pagamento foi validado externamente (extrato, comprovante).
          </DialogDescription>
        </DialogHeader>

        {purchase && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
              <div><strong>Usuário:</strong> {purchase.userName}</div>
              <div><strong>Lances:</strong> {purchase.bids_purchased}</div>
              <div><strong>Valor:</strong> R$ {purchase.amount_paid.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground font-mono break-all">ID: {purchase.id}</div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Esta ação credita os lances imediatamente, aprova comissões de afiliado pendentes e fica registrada no log de auditoria.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="payment_ref">ID/Referência do pagamento (opcional)</Label>
              <Input
                id="payment_ref"
                placeholder="Ex: txId MagenPay, EndToEnd PIX..."
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">
                Justificativa <span className="text-destructive">*</span> (mín. 20 caracteres)
              </Label>
              <Textarea
                id="justification"
                placeholder="Ex: Cliente enviou comprovante em 17/04, pagamento confirmado no extrato MagenPay..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                disabled={loading}
              />
              <div className="text-xs text-muted-foreground text-right">
                {justification.trim().length}/20
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || justification.trim().length < 20}
          >
            {loading ? 'Confirmando...' : 'Confirmar e creditar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmPendingPurchaseDialog;
