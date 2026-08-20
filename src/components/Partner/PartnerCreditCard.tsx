import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePartnerCredit, PartnerCreditDebt } from '@/hooks/usePartnerCredit';
import { HandCoins, AlertTriangle, Loader2, Copy, CheckCircle2 } from 'lucide-react';

const formatPrice = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (value: string) =>
  new Date(value + 'T12:00:00').toLocaleDateString('pt-BR');

const PartnerCreditCard: React.FC = () => {
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const { creditLine, debts, openDebts, availableCredit, isBlocked, totalOpen, hasCredit, loading, refetch } = usePartnerCredit();

  const [payingId, setPayingId] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qrCodeBase64?: string; pixCopyPaste?: string; amount: number } | null>(null);

  if (loading || !hasCredit || !creditLine) return null;

  const usagePct = Number(creditLine.limit_amount) > 0
    ? (Number(creditLine.used_amount) / Number(creditLine.limit_amount)) * 100
    : 0;

  const handleRepay = async (debt: PartnerCreditDebt) => {
    const cpf = (profile as any)?.cpf;
    if (!cpf) {
      toast({ variant: 'destructive', title: 'CPF não cadastrado', description: 'Atualize seu perfil com o CPF para gerar o PIX.' });
      return;
    }

    setPayingId(debt.id);
    try {
      const { data, error } = await supabase.functions.invoke('partner-credit-repay', {
        body: {
          debtId: debt.id,
          userCpf: cpf,
          userName: (profile as any)?.full_name || 'Parceiro',
          userEmail: user?.email || '',
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setPixData({ qrCodeBase64: data.qrCodeBase64, pixCopyPaste: data.pixCopyPaste, amount: data.amount });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar PIX', description: err.message });
    } finally {
      setPayingId(null);
    }
  };

  const copyPix = () => {
    if (pixData?.pixCopyPaste) {
      navigator.clipboard.writeText(pixData.pixCopyPaste);
      toast({ title: 'Código PIX copiado!' });
    }
  };

  return (
    <>
      <Card className={isBlocked ? 'border-destructive' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HandCoins className="h-5 w-5 text-primary" />
            Caixa de Crédito de Confiança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isBlocked && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Você possui devolução vencida. Novas ativações com crédito e solicitações de saque estão bloqueadas até a regularização.</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Limite</p>
              <p className="font-bold">{formatPrice(Number(creditLine.limit_amount))}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Em uso</p>
              <p className="font-bold">{formatPrice(Number(creditLine.used_amount))}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Disponível</p>
              <p className="font-bold text-green-600">{formatPrice(availableCredit)}</p>
            </div>
          </div>

          <Progress value={usagePct} className="h-2" />

          {openDebts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Devoluções em aberto ({formatPrice(totalOpen)})</p>
              {openDebts.map((debt) => (
                <div key={debt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{debt.referred_email || 'Ativação'}</p>
                    <p className="text-xs text-muted-foreground">
                      Vencimento: {formatDate(debt.due_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={debt.status === 'OVERDUE' ? 'destructive' : 'secondary'}>
                      {debt.status === 'OVERDUE' ? 'Vencida' : 'Em aberto'}
                    </Badge>
                    <span className="font-bold text-sm">{formatPrice(Number(debt.amount))}</span>
                    <Button size="sm" onClick={() => handleRepay(debt)} disabled={payingId === debt.id}>
                      {payingId === debt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Devolver'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Nenhuma devolução pendente.
            </p>
          )}

          {debts.filter(d => d.status === 'PAID').length > 0 && (
            <p className="text-xs text-muted-foreground">
              {debts.filter(d => d.status === 'PAID').length} devolução(ões) já quitada(s).
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pixData} onOpenChange={(o) => { if (!o) { setPixData(null); refetch(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Devolução via PIX</DialogTitle>
            <DialogDescription>
              Pague {pixData ? formatPrice(pixData.amount) : ''} para quitar a devolução. A baixa é automática após a confirmação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pixData?.qrCodeBase64 && (
              <img
                src={pixData.qrCodeBase64.startsWith('data:') ? pixData.qrCodeBase64 : `data:image/png;base64,${pixData.qrCodeBase64}`}
                alt="QR Code PIX para devolução do crédito"
                className="w-full max-w-[240px] mx-auto rounded-lg"
              />
            )}
            {pixData?.pixCopyPaste && (
              <>
                <p className="text-xs break-all p-2 bg-muted rounded">{pixData.pixCopyPaste}</p>
                <Button className="w-full" onClick={copyPix}>
                  <Copy className="h-4 w-4 mr-2" /> Copiar código PIX
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PartnerCreditCard;
