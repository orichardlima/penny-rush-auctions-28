import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  FileText,
  CalendarClock,
  ArrowRight,
  HelpCircle,
  Printer,
  MessageCircle,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { useTerminationDetails } from '@/hooks/useTerminationDetails';
import { cn } from '@/lib/utils';

const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
};

const daysBetween = (from: Date, to: Date) => {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const liquidationLabel = (t?: string | null) => {
  switch (t) {
    case 'PARTIAL_REFUND': return 'Estorno PIX (reembolso parcial)';
    case 'CREDITS': return 'Créditos na plataforma';
    case 'BIDS': return 'Conversão em lances';
    default: return t || '—';
  }
};

const statusMeta = (status?: string | null) => {
  switch (status) {
    case 'PENDING':
      return { label: 'Em análise pela equipe', color: 'bg-amber-500/10 text-amber-700 border-amber-500/40 dark:text-amber-300', dot: 'bg-amber-500' };
    case 'APPROVED':
      return { label: 'Aprovado — aguardando pagamento', color: 'bg-sky-500/10 text-sky-700 border-sky-500/40 dark:text-sky-300', dot: 'bg-sky-500' };
    case 'COMPLETED':
      return { label: 'Estorno concluído', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/40 dark:text-emerald-300', dot: 'bg-emerald-500' };
    case 'REJECTED':
      return { label: 'Recusado', color: 'bg-rose-500/10 text-rose-700 border-rose-500/40 dark:text-rose-300', dot: 'bg-rose-500' };
    default:
      return { label: status || '—', color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' };
  }
};

const TimelineStep: React.FC<{
  label: string;
  date?: string | null;
  done: boolean;
  current?: boolean;
  isLast?: boolean;
}> = ({ label, date, done, current, isLast }) => (
  <div className="flex-1 flex flex-col items-center text-center min-w-[120px]">
    <div className="flex items-center w-full">
      <div className={cn('h-0.5 flex-1', isLast && 'invisible', done ? 'bg-emerald-500' : 'bg-muted')} />
      <div className={cn(
        'w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0',
        done ? 'bg-emerald-500 border-emerald-500 text-white' :
        current ? 'bg-background border-primary text-primary' :
                  'bg-background border-muted text-muted-foreground'
      )}>
        {done ? <CheckCircle2 className="h-5 w-5" /> : current ? <Clock className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </div>
      <div className={cn('h-0.5 flex-1', isLast ? 'invisible' : done ? 'bg-emerald-500' : 'bg-muted')} />
    </div>
    <p className={cn('text-xs font-medium mt-2', done || current ? 'text-foreground' : 'text-muted-foreground')}>{label}</p>
    <p className="text-[11px] text-muted-foreground mt-0.5">{date ? formatDate(date) : '—'}</p>
  </div>
);

const EncerramentoDashboard: React.FC = () => {
  const { termination, contract, payouts, referralBonuses, slaDays, loading } = useTerminationDetails();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!contract || !termination) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhum encerramento encontrado</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Você não possui solicitação de encerramento antecipado registrada.
          </p>
          <Link to="/minha-parceria">
            <Button variant="outline">Voltar para Minha Parceria</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const sMeta = statusMeta(termination.status);
  const approvedAt = termination.approved_at || (termination.status !== 'PENDING' ? termination.processed_at : null);
  const paidAt = termination.paid_at;
  const completedAt = termination.status === 'COMPLETED' ? (termination.paid_at || termination.processed_at) : null;
  const isRejected = termination.status === 'REJECTED';

  // SLA calc
  const dueDate = approvedAt ? addDays(approvedAt, slaDays) : null;
  const today = new Date();
  const sla = dueDate ? daysBetween(today, dueDate) : null;
  const slaText =
    termination.status === 'COMPLETED' ? `Pago em ${formatDate(paidAt)}` :
    isRejected ? '—' :
    termination.status === 'PENDING' ? 'Aguardando aprovação para iniciar a contagem do prazo.' :
    sla === null ? '—' :
    sla > 0 ? `Faltam ${sla} dia${sla > 1 ? 's' : ''} (previsão: ${formatDate(dueDate!.toISOString())})` :
    sla === 0 ? `Previsão para hoje (${formatDate(dueDate!.toISOString())})` :
    `Atrasado há ${Math.abs(sla)} dia${Math.abs(sla) > 1 ? 's' : ''} — entre em contato com o suporte.`;

  const finalValue = termination.final_value ?? termination.proposed_value;
  const totalCap = Number(contract.total_cap || 0);
  const aporte = Number(termination.aporte_original || contract.aporte_value || 0);
  const totalReceived = Number(termination.total_received || 0);
  const aporteAfterDiscount = aporte * (1 - Number(termination.discount_percentage || 0) / 100);

  const totalPayoutsPaid = payouts
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <TooltipProvider>
      <div className="space-y-6 print:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold">Acompanhamento do Encerramento</h1>
            <p className="text-sm text-muted-foreground">
              Detalhes completos do seu pedido de encerramento antecipado.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / Salvar PDF
          </Button>
        </div>

        {/* Status hero */}
        <Card className={cn('border-2', sMeta.color)}>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cn('h-3 w-3 rounded-full animate-pulse', sMeta.dot)} />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status atual</p>
                  <p className="text-xl font-bold">{sMeta.label}</p>
                </div>
              </div>
              <Badge variant="outline" className="self-start sm:self-auto">
                Solicitado em {formatDate(termination.requested_at || termination.created_at)}
              </Badge>
            </div>

            {/* Timeline */}
            {!isRejected && (
              <div className="flex items-start gap-1 overflow-x-auto pb-2">
                <TimelineStep label="Solicitado" date={termination.requested_at || termination.created_at} done current={termination.status === 'PENDING'} />
                <TimelineStep label="Aprovado" date={approvedAt} done={!!approvedAt} current={termination.status === 'APPROVED' && !paidAt} />
                <TimelineStep label="Pago" date={paidAt} done={!!paidAt} current={termination.status === 'APPROVED' && !!approvedAt && !paidAt} />
                <TimelineStep label="Concluído" date={completedAt} done={termination.status === 'COMPLETED'} isLast />
              </div>
            )}

            {/* Prazo */}
            {!isRejected && (
              <div className="rounded-lg border bg-background/60 p-4 flex items-start gap-3">
                <CalendarClock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">Prazo para pagamento do estorno</p>
                  <p className="text-muted-foreground">
                    A empresa tem até <strong>{slaDays} dias corridos</strong> após a aprovação para concluir o pagamento via PIX.
                  </p>
                  <p className="mt-1 font-medium">{slaText}</p>
                </div>
              </div>
            )}

            {isRejected && termination.admin_notes && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Motivo da recusa:</strong> {termination.admin_notes}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Detalhamento financeiro */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Detalhamento Financeiro</CardTitle>
                <CardDescription>Conta transparente do cálculo do estorno.</CardDescription>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon"><HelpCircle className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    <strong>Fórmula:</strong> (Aporte × (1 − deságio%)) − Total já recebido em payouts = Valor do estorno.
                    O deságio recai sobre o aporte, não sobre o teto total.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Aporte original</TableCell>
                  <TableCell className="text-right">{formatBRL(aporte)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Teto total do contrato (2× aporte)</TableCell>
                  <TableCell className="text-right">{formatBRL(totalCap)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Total já recebido em payouts</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                    − {formatBRL(totalReceived)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Saldo restante do teto (abre mão)</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatBRL(termination.remaining_cap)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Deságio aplicado sobre o aporte</TableCell>
                  <TableCell className="text-right">{Number(termination.discount_percentage).toFixed(0)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Aporte com deságio</TableCell>
                  <TableCell className="text-right">{formatBRL(aporteAfterDiscount)}</TableCell>
                </TableRow>
                <TableRow className="bg-primary/5">
                  <TableCell className="font-bold text-base">Valor final do estorno</TableCell>
                  <TableCell className="text-right font-bold text-base text-primary">{formatBRL(finalValue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Forma de liquidação</TableCell>
                  <TableCell className="text-right">{liquidationLabel(termination.liquidation_type)}</TableCell>
                </TableRow>
                {termination.payout_reference && (
                  <TableRow>
                    <TableCell className="font-medium">Referência da transação</TableCell>
                    <TableCell className="text-right font-mono text-xs">{termination.payout_reference}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Histórico de payouts */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Payouts Semanais Recebidos</CardTitle>
            <CardDescription>Todos os repasses semanais pagos durante a vigência do contrato.</CardDescription>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum payout registrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semana</TableHead>
                    <TableHead>Calculado</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data do pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {formatDate(p.period_start)} – {formatDate(p.period_end)}
                      </TableCell>
                      <TableCell>{formatBRL(p.calculated_amount)}</TableCell>
                      <TableCell className="font-medium">{formatBRL(p.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'PAID' ? 'default' : p.status === 'PENDING' ? 'secondary' : 'destructive'}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.paid_at ? formatDate(p.paid_at) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Separator className="my-3" />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total acumulado pago:</span>
              <span className="font-bold text-base">{formatBRL(totalPayoutsPaid)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Bônus de indicação */}
        {referralBonuses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Bônus de Indicação Recebidos</CardTitle>
              <CardDescription>Comissões geradas pela sua rede durante o contrato.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Indicado</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralBonuses.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-sm">{formatDate(b.created_at)}</TableCell>
                      <TableCell className="text-sm">{b.source_user_name || '—'}</TableCell>
                      <TableCell>L{b.level}</TableCell>
                      <TableCell className="font-medium">{formatBRL(b.bonus_amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{b.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Dados do contrato encerrado */}
        <Card>
          <CardHeader>
            <CardTitle>Contrato Encerrado</CardTitle>
            <CardDescription>Resumo do contrato que foi liquidado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Plano</p>
                <p className="font-semibold">{contract.plan_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cotas</p>
                <p className="font-semibold">{contract.cotas}× </p>
              </div>
              <div>
                <p className="text-muted-foreground">Aporte</p>
                <p className="font-semibold">{formatBRL(contract.aporte_value)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Teto semanal</p>
                <p className="font-semibold">{formatBRL(contract.weekly_cap)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Data de início</p>
                <p className="font-semibold">{formatDate(contract.created_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Data de encerramento</p>
                <p className="font-semibold">{formatDate(contract.closed_at)}</p>
              </div>
              {termination.liquidation_type === 'PARTIAL_REFUND' && contract.pix_key && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Chave PIX cadastrada para recebimento</p>
                  <p className="font-mono text-sm break-all">{contract.pix_key} <Badge variant="outline" className="ml-1 text-xs">{contract.pix_key_type}</Badge></p>
                </div>
              )}
            </div>
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Sua posição na rede binária e o histórico de indicações continuam preservados — isso evita quebrar a estrutura
                dos parceiros que estão acima ou abaixo de você. Você pode contratar um novo plano a qualquer momento.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Próximos passos */}
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/minha-parceria" className="block">
                <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-5 space-y-2">
                    <Briefcase className="h-6 w-6 text-primary" />
                    <p className="font-semibold">Contratar novo plano</p>
                    <p className="text-xs text-muted-foreground">Volte a ser Parceiro com um contrato novo.</p>
                    <div className="flex items-center text-primary text-sm pt-1">Ver planos <ArrowRight className="h-3 w-3 ml-1" /></div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/contato" className="block">
                <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-5 space-y-2">
                    <MessageCircle className="h-6 w-6 text-primary" />
                    <p className="font-semibold">Falar com suporte</p>
                    <p className="text-xs text-muted-foreground">Tire dúvidas ou reporte atraso no estorno.</p>
                    <div className="flex items-center text-primary text-sm pt-1">Abrir contato <ArrowRight className="h-3 w-3 ml-1" /></div>
                  </CardContent>
                </Card>
              </Link>
              <button type="button" onClick={() => window.print()} className="block text-left">
                <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-5 space-y-2">
                    <Printer className="h-6 w-6 text-primary" />
                    <p className="font-semibold">Baixar comprovante</p>
                    <p className="text-xs text-muted-foreground">Salve esta página em PDF para seus registros.</p>
                    <div className="flex items-center text-primary text-sm pt-1">Imprimir <ArrowRight className="h-3 w-3 ml-1" /></div>
                  </CardContent>
                </Card>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default EncerramentoDashboard;
