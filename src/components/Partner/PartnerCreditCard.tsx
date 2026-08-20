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
  const { creditLine, debts, openDebts, availableCredit, isBlocked, isExpired, totalOpen, hasCredit, loading, refetch } = usePartnerCredit();

  const [payingId, setPayingId] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qrCodeBase64?: string; pixCopyPaste?: string; amount: number } | null>(null);
  const [partialDebt, setPartialDebt] = useState<PartnerCreditDebt | null>(null);
  const [partialValue, setPartialValue] = useState('');

  if (loading || !hasCredit || !creditLine) return null;

  const usagePct = Number(creditLine.limit_amount) > 0
    ? (Number(creditLine.used_amount) / Number(creditLine.limit_amount)) * 100
    : 0;

  const remainingOf = (debt: PartnerCreditDebt) =>
    Math.max(0, Number(debt.amount) - Number(debt.paid_amount || 0));

  const handleRepay = async (debt: PartnerCreditDebt, amount?: number) => {
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
          ...(amount ? { amount } : {}),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setPartialDebt(null);
      setPartialValue('');
      setPixData({ qrCodeBase64: data.qrCodeBase64, pixCopyPaste: data.pixCopyPaste, amount: data.amount });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar PIX', description: err.message });
    } finally {
      setPayingId(null);
    }
  };

  const handlePartialSubmit = () => {
    if (!partialDebt) return;
    const parsed = parseFloat(partialValue.replace(',', '.'));
    const remaining = remainingOf(partialDebt);
    if (isNaN(parsed) || parsed <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor válido' });
      return;
    }
    if (parsed > remaining + 0.009) {
      toast({ variant: 'destructive', title: `Valor acima do saldo devedor (${formatPrice(remaining)})` });
      return;
    }
    handleRepay(partialDebt, parsed);
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

          {isExpired && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Seu limite expirou em {formatDate(creditLine.valid_until!)}. Fale com o administrador para renovar.</span>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              O prazo de devolução só começa a contar quando você <strong>usa</strong> o crédito.
              Limite parado não gera cobrança e cada ativação tem o seu próprio vencimento.
            </span>
          </div>

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

          {creditLine.valid_until && !isExpired && (
            <p className="text-xs text-muted-foreground">
              Limite válido para uso até {formatDate(creditLine.valid_until)}.
            </p>
          )}

          {openDebts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Devoluções em aberto ({formatPrice(totalOpen)})</p>
              {openDebts.map((debt) => {
                const remaining = remainingOf(debt);
                const partiallyPaid = Number(debt.paid_amount || 0) > 0;
                return (
                  <div key={debt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{debt.referred_email || 'Ativação'}</p>
                      <p className="text-xs text-muted-foreground">
                        Usado em {new Date(debt.created_at).toLocaleDateString('pt-BR')} · vence {formatDate(debt.due_date)}
                      </p>
                      {partiallyPaid && (
                        <p className="text-xs text-green-600">
                          Já devolvido: {formatPrice(Number(debt.paid_amount))}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={debt.status === 'OVERDUE' ? 'destructive' : 'secondary'}>
                        {debt.status === 'OVERDUE' ? 'Vencida' : 'Em aberto'}
                      </Badge>
                      <span className="font-bold text-sm">{formatPrice(remaining)}</span>
                      <Button size="sm" variant="outline" onClick={() => { setPartialDebt(debt); setPartialValue(''); }}>
                        Parcial
                      </Button>
                      <Button size="sm" onClick={() => handleRepay(debt)} disabled={payingId === debt.id}>
                        {payingId === debt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Devolver tudo'}
                      </Button>
                    </div>
                  </div>
                );
              })}
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

      <Dialog open={!!partialDebt} onOpenChange={(o) => { if (!o) setPartialDebt(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Devolução parcial</DialogTitle>
            <DialogDescription>
              Saldo devedor: {partialDebt ? formatPrice(remainingOf(partialDebt)) : ''}. O restante continua em aberto até o vencimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Valor a devolver (R$)</Label>
            <Input
              value={partialValue}
              onChange={(e) => setPartialValue(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDebt(null)}>Cancelar</Button>
            <Button onClick={handlePartialSubmit} disabled={!!payingId}>
              {payingId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar PIX'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
