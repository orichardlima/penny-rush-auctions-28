import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Info, RefreshCw, PlayCircle, ShieldCheck } from 'lucide-react';

const sb = supabase as any;

const brl = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const dt = (v?: string | null) => (v ? new Date(v.length === 10 ? v + 'T12:00:00' : v).toLocaleDateString('pt-BR') : '—');
const dtt = (v?: string | null) => (v ? new Date(v).toLocaleString('pt-BR') : '—');

const STAGES: { key: string; label: string; field: string }[] = [
  { key: 'CLOSE', label: 'Fechamento', field: 'close_status' },
  { key: 'RELEASE', label: 'Liberação na carteira', field: 'release_status' },
  { key: 'FINANCIAL_INTEGRITY', label: 'Auditoria financeira', field: 'financial_audit_status' },
  { key: 'CAREER_DRY_RUN', label: 'Simulação de carreira', field: 'career_dry_run_status' },
  { key: 'CAREER_OFFICIAL', label: 'Avaliação oficial', field: 'career_official_status' },
  { key: 'RANK_NOTIFICATIONS', label: 'Notificações', field: 'notification_status' },
  { key: 'FINAL_INTEGRITY', label: 'Auditoria final', field: 'final_audit_status' },
  { key: 'ADMIN_SUMMARY', label: 'Resumo administrativo', field: '' },
];

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Não iniciado',
  PENDING: 'Aguardando',
  PROCESSING: 'Em execução',
  COMPLETED: 'Concluído',
  SKIPPED_NOT_APPLICABLE: 'Não aplicável',
  SKIPPED_DISABLED: 'Desativado',
  WAITING_RETRY: 'Aguardando nova tentativa',
  PARTIAL_FAILURE: 'Concluído com pendências',
  BLOCKED: 'Bloqueado',
  BLOCKED_INTEGRITY: 'Bloqueado por integridade',
  FAILED: 'Falhou',
};

// verde / amarelo / vermelho / cinza
const tone = (s?: string | null) => {
  switch (s) {
    case 'COMPLETED':
      return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
    case 'SKIPPED_NOT_APPLICABLE':
      return 'bg-muted text-muted-foreground border-border';
    case 'PROCESSING':
    case 'WAITING_RETRY':
    case 'PARTIAL_FAILURE':
    case 'SKIPPED_DISABLED':
      return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
    case 'BLOCKED':
    case 'BLOCKED_INTEGRITY':
    case 'FAILED':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const StatusBadge = ({ status }: { status?: string | null }) => (
  <Badge variant="outline" className={tone(status)}>
    {STATUS_LABEL[status || 'NOT_STARTED'] || status}
  </Badge>
);

export default function ExpansionAutomationPanel() {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await sb.rpc('expansion_admin_orchestration', { _limit: 20 });
      if (error) throw error;
      setRuns(data || []);
    } catch (e: any) {
      toast.error('Não foi possível carregar a automação semanal', { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (period: string, action: 'RETRY' | 'DRY_RUN') => {
    setBusy(period + action);
    try {
      const { data, error } = await sb.rpc('expansion_admin_orchestration_action', {
        _period_start: period,
        _action: action,
      });
      if (error) throw error;
      const status = data?.status || 'OK';
      toast.success(action === 'RETRY' ? 'Nova tentativa executada' : 'Nova simulação executada', {
        description: `Resultado: ${STATUS_LABEL[status] || status}`,
      });
      await load();
    } catch (e: any) {
      toast.error('Não foi possível concluir a ação', { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Automação semanal ativa</AlertTitle>
        <AlertDescription className="text-xs">
          Segunda-feira, horário da Bahia: 00:05 fechamento · 00:10 liberação · 00:20 orquestração integral
          (auditoria, simulação de carreira, avaliação oficial, notificações e resumo). Recuperação automática a cada
          30 minutos entre 00:30 e 05:30 de segunda e verificação diária às 03:40. Nenhuma conferência manual é
          necessária: o administrador só é acionado quando existe uma inconsistência não recuperável.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {runs.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma orquestração registrada ainda. O primeiro ciclo automático processa o período encerrado em
            02/08/2026 e roda em 03/08/2026 às 00:20 (Bahia).
          </CardContent>
        </Card>
      )}

      {runs.map((r) => {
        const stages = r.stages || {};
        const s = r.summary || {};
        const attention = ['BLOCKED_INTEGRITY', 'FAILED', 'PARTIAL_FAILURE'].includes(r.status);
        return (
          <Card key={r.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {attention ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : r.status === 'COMPLETED' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" />
                    )}
                    Período {dt(r.period_start)} a {dt(r.period_end)}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Início {dtt(r.started_at)} · Término {dtt(r.finished_at)} · Tentativas {r.retry_count}
                    {r.next_retry_at ? ` · Próximo retry ${dtt(r.next_retry_at)}` : ''}
                  </CardDescription>
                </div>
                <StatusBadge status={r.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {STAGES.map((st) => {
                  const stage = stages[st.key] || {};
                  const status = stage.status || (st.field ? r[st.field] : null) || 'NOT_STARTED';
                  return (
                    <div key={st.key} className="rounded-md border p-2">
                      <p className="text-xs text-muted-foreground">{st.label}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <StatusBadge status={status} />
                        {stage.attempt_count ? (
                          <span className="text-[11px] text-muted-foreground">{stage.attempt_count}x</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {r.status === 'COMPLETED' && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                  <p className="font-medium">Programa de Expansão processado</p>
                  <p>
                    Parceiros encontrados: {s.partners_found ?? s.partners ?? 0} · Elegíveis:{' '}
                    {s.partners_eligible ?? s.partners ?? 0} · Avaliados: {s.partners_evaluated ?? s.partners ?? 0} ·
                    Excluídos: {s.partners_excluded ?? 0} · Principal motivo de exclusão:{' '}
                    {(s.partners_excluded ?? 0) === 0 ? 'nenhum' : s.top_exclusion_reason || '—'}
                  </p>
                  <p>
                    Bônus liberado: {brl(s.released_total)} · Promoções: {s.promoted ?? 0} · Rebaixamentos:{' '}
                    {s.downgraded ?? 0} · Status final: concluído
                  </p>
                  {s.reconciliation?.note && (
                    <p className="text-muted-foreground">{s.reconciliation.note}</p>
                  )}
                </div>
              )}


              {attention && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Programa de Expansão requer atenção</AlertTitle>
                  <AlertDescription className="text-xs">
                    Etapa {r.current_stage || '—'} · {r.error_summary || 'Verifique a auditoria de integridade.'} O
                    fechamento financeiro, os consumos, a carteira e as graduações foram preservados.
                  </AlertDescription>
                </Alert>
              )}

              {(s.medium || s.info) && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Auditoria: {s.critical ?? 0} críticas · {s.high ?? 0} altas · {s.medium ?? 0} médias · {s.info ?? 0}{' '}
                  informativas
                </p>
              )}

              <Accordion type="single" collapsible>
                <AccordionItem value="detail">
                  <AccordionTrigger className="text-xs">Ver detalhes das etapas</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {STAGES.map((st) => {
                        const stage = stages[st.key];
                        if (!stage) return null;
                        return (
                          <div key={st.key} className="rounded-md border p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{st.label}</span>
                              <StatusBadge status={stage.status} />
                            </div>
                            <p className="text-muted-foreground mt-1">
                              Início {dtt(stage.started_at)} · Fim {dtt(stage.finished_at)} · Tentativas{' '}
                              {stage.attempt_count ?? 0}
                              {stage.next_retry_at ? ` · Próximo retry ${dtt(stage.next_retry_at)}` : ''}
                            </p>
                            {stage.error_summary && (
                              <p className="text-destructive mt-1">{stage.error_summary}</p>
                            )}
                            {stage.result_summary && Object.keys(stage.result_summary).length > 0 && (
                              <pre className="mt-1 overflow-x-auto text-[11px] text-muted-foreground">
                                {JSON.stringify(stage.result_summary, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null || r.status === 'COMPLETED'}
                  onClick={() => runAction(r.period_start, 'RETRY')}
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Nova tentativa (idempotente)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => runAction(r.period_start, 'DRY_RUN')}
                >
                  <PlayCircle className="h-4 w-4 mr-2" /> Executar simulação de carreira
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ações administrativas não alteram bônus, VQE, consumo, carteira ou graduação: apenas reexecutam os
                motores oficiais de forma idempotente.
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
