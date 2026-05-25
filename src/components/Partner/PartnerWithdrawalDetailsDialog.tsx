import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Info, Gift, TrendingDown } from 'lucide-react';
import { PartnerWithdrawal } from '@/hooks/usePartnerWithdrawals';

interface Payout {
  id: string;
  period_start: string;
  period_end: string;
  calculated_amount: number;
  amount: number;
  weekly_cap_applied: boolean;
  total_cap_applied: boolean;
  source: string;
  paid_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawal: PartnerWithdrawal | null;
  previousWithdrawalDate: string | null;
  contractId: string;
}

const formatPrice = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const PartnerWithdrawalDetailsDialog: React.FC<Props> = ({
  open, onOpenChange, withdrawal, previousWithdrawalDate, contractId,
}) => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !withdrawal) return;
    const load = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('partner_payouts')
          .select('id, period_start, period_end, calculated_amount, amount, weekly_cap_applied, total_cap_applied, source, paid_at')
          .eq('partner_contract_id', contractId)
          .eq('status', 'PAID')
          .lte('paid_at', withdrawal.requested_at)
          .order('paid_at', { ascending: true });

        if (previousWithdrawalDate) {
          query = query.gt('paid_at', previousWithdrawalDate);
        }

        const { data, error } = await query;
        if (error) throw error;
        setPayouts((data || []) as Payout[]);
      } catch (e) {
        console.error('Erro ao carregar payouts:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, withdrawal, previousWithdrawalDate, contractId]);

  const getReductionInfo = (p: Payout) => {
    if (p.source === 'referral_bonus') {
      return { label: 'Bônus de indicação', tone: 'bonus' as const, detail: 'Crédito integral, sem reduções' };
    }
    const reductions: string[] = [];
    if (p.total_cap_applied) reductions.push('Teto total do contrato aplicado');
    if (p.weekly_cap_applied) reductions.push('Teto semanal aplicado');

    const diff = Number(p.calculated_amount) - Number(p.amount);
    if (diff > 0.001) {
      const unlockPct = p.calculated_amount > 0
        ? Math.round((Number(p.amount) / Number(p.calculated_amount)) * 100)
        : 0;
      // Approx: base 70% + 30%/5 dias = 6% por dia confirmado
      const estimatedDays = Math.max(0, Math.round((unlockPct - 70) / 6));
      reductions.push(
        `Central de Anúncios: ${estimatedDays}/5 dias confirmados (desbloqueio ${unlockPct}%)`
      );
    }

    if (reductions.length === 0) {
      return { label: 'Repasse integral', tone: 'ok' as const, detail: '100% do calculado foi creditado' };
    }
    return { label: 'Com reduções', tone: 'warn' as const, detail: reductions.join(' • ') };
  };

  const totalCalculado = payouts.reduce((s, p) => s + Number(p.calculated_amount), 0);
  const totalPago = payouts.reduce((s, p) => s + Number(p.amount), 0);
  const totalReducao = totalCalculado - totalPago;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhamento do Saque</DialogTitle>
          <DialogDescription>
            {withdrawal && (
              <>
                Saque de <strong>{formatPrice(withdrawal.amount)}</strong> solicitado em{' '}
                {new Date(withdrawal.requested_at).toLocaleString('pt-BR')}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Este saque foi composto pelos repasses creditados no período entre o saque anterior (ou início do contrato)
            e a data desta solicitação.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total calculado</p>
            <p className="text-lg font-bold">{formatPrice(totalCalculado)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total pago no payout</p>
            <p className="text-lg font-bold text-primary">{formatPrice(totalPago)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Reduções
            </p>
            <p className={`text-lg font-bold ${totalReducao > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {formatPrice(totalReducao)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum repasse encontrado para este período.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Calculado</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead>Origem / Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => {
                const info = getReductionInfo(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {formatDate(p.period_start)}
                      {p.period_start !== p.period_end && (
                        <> — {formatDate(p.period_end)}</>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatPrice(Number(p.calculated_amount))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(Number(p.amount))}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant="outline"
                          className={
                            info.tone === 'bonus'
                              ? 'bg-purple-500/10 text-purple-700 border-purple-500/20'
                              : info.tone === 'warn'
                                ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                                : 'bg-green-500/10 text-green-700 border-green-500/20'
                          }
                        >
                          {info.tone === 'bonus' && <Gift className="h-3 w-3 mr-1" />}
                          {info.label}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{info.detail}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PartnerWithdrawalDetailsDialog;
