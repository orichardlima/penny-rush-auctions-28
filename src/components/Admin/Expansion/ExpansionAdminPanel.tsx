import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  AlertTriangle, CalendarClock, CheckCircle2, Gauge, History, Info, ListChecks,
  Lock, RefreshCw, Settings2, ShieldCheck, Users, Wallet,
} from 'lucide-react';

import ExpansionClosePreviewDialog from './ExpansionClosePreviewDialog';
import ExpansionPartnerPointsReport from './ExpansionPartnerPointsReport';
import ExpansionIntegrityReport from './ExpansionIntegrityReport';
import ExpansionCommunicationPanel from './ExpansionCommunicationPanel';

const sb = supabase as any;

const brl = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const pts = (v: any) => new Intl.NumberFormat('pt-BR').format(Math.round(Number(v || 0)));
const dt = (v?: string | null) => (v ? new Date(v.length === 10 ? v + 'T12:00:00' : v).toLocaleDateString('pt-BR') : '—');
const dtt = (v?: string | null) => (v ? new Date(v).toLocaleString('pt-BR') : '—');

const STATUS_LABEL: Record<string, string> = {
  draft: 'Em processamento',
  closed: 'Fechamento concluído',
  released: 'Crédito liberado',
};

const PLANS = ['START', 'PRO', 'ELITE', 'Master', 'Legend', 'Diamond'];

export default function ExpansionAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState<string>('');

  // settings form
  const [percent, setPercent] = useState('20');
  const [caps, setCaps] = useState<Record<string, string>>({});
  const [officialStart, setOfficialStart] = useState('');
  const [closeEnabled, setCloseEnabled] = useState(false);
  const [payoutEnabled, setPayoutEnabled] = useState(false);
  const [settingsReason, setSettingsReason] = useState('');
  const [saving, setSaving] = useState(false);

  // manual close
  const [closePeriod, setClosePeriod] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, pe, sn, rn, aj, au] = await Promise.all([
        sb.rpc('expansion_admin_overview'),
        sb.rpc('expansion_admin_periods'),
        sb.rpc('expansion_admin_snapshots', { _period_start: periodFilter || null, _search: search || null }),
        sb.rpc('expansion_admin_runs', {}),
        sb.rpc('expansion_admin_adjustments', { _limit: 200 }),
        sb.rpc('expansion_admin_audit_log', { _limit: 200 }),
      ]);
      if (ov.error) throw ov.error;
      setOverview(ov.data);
      setPeriods(pe.data || []);
      setSnapshots(sn.data || []);
      setRuns(rn.data || []);
      setAdjustments(aj.data || []);
      setAudit(au.data || []);

      const s = ov.data?.settings || {};
      setPercent(String(s.expansion_bonus_percent ?? '20'));
      setOfficialStart(s.expansion_official_start_at || '');
      setCloseEnabled(String(s.expansion_weekly_close_enabled) === 'true');
      setPayoutEnabled(String(s.expansion_bonus_payout_enabled) === 'true');
      try {
        const parsed = JSON.parse(s.expansion_weekly_caps || '{}');
        const m: Record<string, string> = {};
        PLANS.forEach((p) => { m[p] = String(parsed[p] ?? 0); });
        setCaps(m);
      } catch { /* mantém valores atuais */ }
    } catch (e: any) {
      toast.error(e?.message?.includes('not authorized') ? 'Você não tem permissão administrativa para esta área.' : 'Erro ao carregar dados do programa.');
    } finally {
      setLoading(false);
    }
  }, [periodFilter, search]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const capsObj: Record<string, number> = {};
      PLANS.forEach((p) => { capsObj[p] = Number(caps[p] || 0); });
      const payload: Record<string, string> = {
        expansion_bonus_percent: String(Number(percent || 0)),
        expansion_weekly_caps: JSON.stringify(capsObj),
        expansion_official_start_at: officialStart || '',
        expansion_weekly_close_enabled: closeEnabled ? 'true' : 'false',
        expansion_bonus_payout_enabled: payoutEnabled ? 'true' : 'false',
      };
      const { error } = await sb.rpc('expansion_admin_update_settings', { _settings: payload, _reason: settingsReason || null });
      if (error) throw error;
      toast.success('Configurações salvas. Valem para fechamentos futuros.');
      setSettingsReason('');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const runManualClose = async () => {
    if (!closePeriod || !closeReason.trim()) {
      toast.error('Informe o período (segunda-feira) e o motivo.');
      return;
    }
    setClosing(true);
    try {
      const { data, error } = await sb.rpc('expansion_admin_close_week', { _period_start: closePeriod, _reason: closeReason });
      if (error) throw error;
      const res = data || {};
      if (res.status === 'ALREADY_CLOSED') {
        toast.info('Este período já foi fechado anteriormente. Nenhum snapshot foi substituído.');
      } else {
        toast.success(`Fechamento executado. Parceiros fechados: ${res.closed_count ?? res.closed ?? 0}.`);
      }
      setCloseOpen(false);
      setCloseReason('');
      load();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('ALREADY_CLOSED')) toast.info('Este período já foi fechado anteriormente.');
      else if (msg.includes('Monday')) toast.error('O período deve começar em uma segunda-feira.');
      else if (msg.includes('not finished')) toast.error('Esta semana ainda não terminou.');
      else if (msg.includes('not authorized')) toast.error('Você não tem permissão administrativa.');
      else toast.error(msg || 'Erro ao executar o fechamento');
    } finally {
      setClosing(false);
    }
  };

  if (loading && !overview) return <Skeleton className="h-96 w-full" />;

  const s = overview?.settings || {};
  const officialDefined = !!s.expansion_official_start_at;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Bônus de Expansão</h2>
          <p className="text-sm text-muted-foreground">Programa de Expansão por Equipes — operação e auditoria</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="h-auto flex flex-wrap gap-1 p-2">
          <TabsTrigger value="overview" className="shrink-0">Visão geral</TabsTrigger>
          <TabsTrigger value="periods" className="shrink-0">Períodos</TabsTrigger>
          <TabsTrigger value="partners" className="shrink-0">Parceiros</TabsTrigger>
          <TabsTrigger value="teams" className="shrink-0">Equipes</TabsTrigger>
          <TabsTrigger value="consolidated" className="shrink-0">Consolidado</TabsTrigger>
          <TabsTrigger value="integrity" className="shrink-0">Integridade</TabsTrigger>
          <TabsTrigger value="communication" className="shrink-0">Comunicação</TabsTrigger>
          <TabsTrigger value="consumptions" className="shrink-0">Consumos</TabsTrigger>
          <TabsTrigger value="runs" className="shrink-0">Execuções</TabsTrigger>
          <TabsTrigger value="adjustments" className="shrink-0">Ajustes e reversões</TabsTrigger>
          <TabsTrigger value="settings" className="shrink-0">Configurações</TabsTrigger>
          <TabsTrigger value="audit" className="shrink-0">Auditoria</TabsTrigger>
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="overview" className="space-y-3 mt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {!officialDefined && (
              <Alert className="sm:col-span-2 lg:col-span-3 border-amber-500/40">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Data oficial de início não definida</AlertTitle>
                <AlertDescription className="text-sm">O programa está em modo de preparação para os parceiros.</AlertDescription>
              </Alert>
            )}
            {String(s.expansion_weekly_close_enabled) !== 'true' && (
              <Alert className="sm:col-span-2 lg:col-span-3">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">Fechamento automático <strong>desligado</strong> — nenhum fechamento ocorre sozinho.</AlertDescription>
              </Alert>
            )}
            {String(s.expansion_bonus_payout_enabled) !== 'true' && (
              <Alert className="sm:col-span-2 lg:col-span-3">
                <Lock className="h-4 w-4" />
                <AlertDescription className="text-sm">Pagamento do bônus <strong>desligado</strong> — nenhum crédito financeiro é gerado.</AlertDescription>
              </Alert>
            )}
            {Number(overview?.snapshots_closed_count || 0) > 0 && (
              <Alert className="sm:col-span-2 lg:col-span-3">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {overview.snapshots_closed_count} fechamento(s) aguardando liberação ({brl(overview.bonus_pending_release)}).
                </AlertDescription>
              </Alert>
            )}
            {(overview?.recent_errors || []).length > 0 && (
              <Alert variant="destructive" className="sm:col-span-2 lg:col-span-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erros recentes em execuções</AlertTitle>
                <AlertDescription className="text-xs">
                  {overview.recent_errors.map((e: any) => (
                    <div key={e.id}>{dt(e.period_start)} — {e.status}: {e.error_message || 'erro'}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
            {[
              { i: ListChecks, l: 'Geração de pontos', v: String(s.expansion_points_generation_enabled) === 'true' ? 'Ativa' : 'Desligada' },
              { i: CalendarClock, l: 'Fechamento automático', v: String(s.expansion_weekly_close_enabled) === 'true' ? 'Ativo' : 'Desligado' },
              { i: Wallet, l: 'Pagamento do bônus', v: String(s.expansion_bonus_payout_enabled) === 'true' ? 'Ativo' : 'Desligado' },
              { i: CalendarClock, l: 'Data oficial de início', v: officialDefined ? dt(s.expansion_official_start_at) : 'Não definida' },
              { i: History, l: 'Último período encerrado', v: dt(overview?.last_closed_week) },
              { i: CalendarClock, l: 'Próximo fechamento', v: dt(overview?.next_close_date) },
              { i: Users, l: 'Parceiros com equipes', v: pts(overview?.partners_with_teams) },
              { i: Users, l: 'Total de equipes', v: pts(overview?.teams_total) },
              { i: Gauge, l: 'Pontos disponíveis', v: `${pts(overview?.points_available_total)} pts` },
              { i: Gauge, l: 'VQE agregado', v: `${pts(overview?.vqe_total)} pts` },
              { i: Wallet, l: 'Bônus calculado (a liberar)', v: brl(overview?.bonus_pending_release) },
              { i: Wallet, l: 'Bônus já liberado', v: brl(overview?.bonus_released) },
            ].map((c) => (
              <div key={c.l} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <c.i className="h-3.5 w-3.5" /><span className="truncate">{c.l}</span>
                </div>
                <p className="font-bold text-sm break-words">{c.v}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* PERÍODOS */}
        <TabsContent value="periods" className="space-y-3 mt-4">
          <div className="flex justify-end gap-2 flex-wrap">
            <ExpansionClosePreviewDialog defaultPeriodStart={overview?.current_period_start || ''} />
            <Dialog open={closeOpen} onOpenChange={setCloseOpen}>

              <DialogTrigger asChild>
                <Button size="sm"><CalendarClock className="h-4 w-4 mr-1" /> Fechamento manual</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Fechamento manual de período</DialogTitle>
                  <DialogDescription>
                    Utiliza a função oficial já validada. O fechamento não pode ser duplicado e snapshots já fechados
                    nunca são substituídos.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Período (segunda-feira inicial)</Label>
                    <Input type="date" value={closePeriod} onChange={(e) => setClosePeriod(e.target.value)} />
                  </div>
                  <div>
                    <Label>Motivo</Label>
                    <Textarea value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Descreva o motivo do fechamento manual" />
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs space-y-1">
                      <div>Parceiros com equipes: <strong>{pts(overview?.partners_with_teams)}</strong> (estimativa de elegíveis).</div>
                      <div>Pagamento do bônus: <strong>{String(s.expansion_bonus_payout_enabled) === 'true' ? 'LIGADO' : 'DESLIGADO'}</strong> — nesta etapa nenhum crédito é gerado.</div>
                      <div>Fechamentos já concluídos retornam “período já fechado”.</div>
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancelar</Button>
                  <Button onClick={runManualClose} disabled={closing}>{closing ? 'Executando…' : 'Confirmar fechamento'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {periods.length === 0 && <p className="text-sm text-muted-foreground">Nenhum período processado até o momento.</p>}
          {periods.map((p: any) => (
            <Card key={p.period_start}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{dt(p.period_start)} — {dt(p.period_end)}</CardTitle>
                <CardDescription className="text-xs">
                  run_id: {p.run?.run_id || '—'} · origem: {p.run?.origin || '—'} · status: {p.run?.status || '—'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>Processados: <strong>{p.run?.processed_count ?? p.snapshots}</strong></div>
                <div>Fechados: <strong>{p.closed}</strong></div>
                <div>Já fechados: <strong>{p.run?.already_closed_count ?? 0}</strong></div>
                <div>Sem volume: <strong>{p.run?.no_volume_count ?? 0}</strong></div>
                <div>Erros: <strong>{p.run?.error_count ?? 0}</strong></div>
                <div>VQE total: <strong>{pts(p.vqe_total)}</strong></div>
                <div>Bônus calculado: <strong>{brl(p.bonus_total)}</strong></div>
                <div>Liberado: <strong>{brl(p.bonus_released_total)}</strong></div>
                <div className="col-span-2 sm:col-span-4">
                  <Button variant="outline" size="sm" onClick={() => setPeriodFilter(p.period_start)}>Ver snapshots do período</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* PARCEIROS (snapshots) */}
        <TabsContent value="partners" className="space-y-3 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Buscar parceiro" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Input type="date" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className="max-w-[180px]" />
            {periodFilter && <Button variant="ghost" size="sm" onClick={() => setPeriodFilter('')}>Limpar período</Button>}
          </div>
          {snapshots.length === 0 && <p className="text-sm text-muted-foreground">Nenhum snapshot encontrado.</p>}
          <Accordion type="single" collapsible>
            {snapshots.map((sp: any) => (
              <AccordionItem key={sp.id} value={sp.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-left w-full pr-2 text-sm">
                    <span className="font-medium">{sp.partner_name}</span>
                    <span className="text-muted-foreground text-xs">{dt(sp.period_start)} — {dt(sp.period_end)}</span>
                    <span className="font-semibold text-primary">{brl(sp.final_bonus)}</span>
                    <Badge variant="outline" className="w-fit text-[10px]">{STATUS_LABEL[sp.status_official] || sp.status_official}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-3">
                    <div>Plano: <strong>{sp.plan_name || '—'}</strong></div>
                    <div>Contrato: <strong>{sp.contract_id ? String(sp.contract_id).slice(0, 8) : '—'}</strong></div>
                    <div>Teto semanal: <strong>{brl(sp.weekly_cap)}</strong></div>
                    <div>Maior equipe: <strong>{pts(sp.largest_team_points)}</strong></div>
                    <div>Demais equipes: <strong>{pts(sp.other_teams_points)}</strong></div>
                    <div>VQE: <strong>{pts(sp.vqe_points)}</strong></div>
                    <div>VQE pagável: <strong>{pts(sp.payable_vqe_points)}</strong></div>
                    <div>Percentual: <strong>{Number(sp.bonus_percent)}%</strong></div>
                    <div>Consumo total: <strong>{pts(sp.total_points_consumed)}</strong></div>
                    <div>Carryforward: <strong>{pts(sp.carryforward_points)}</strong></div>
                    <div>Fechado em: <strong>{dtt(sp.closed_at)}</strong></div>
                    <div>Liberado em: <strong>{dtt(sp.released_at)}</strong></div>
                    <div className="col-span-2 sm:col-span-3">Referência financeira: <strong>{sp.payout_reference || '—'}</strong></div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Consumo por equipe</p>
                  {(sp.consumptions || []).map((c: any) => (
                    <div key={c.team_root_user_id} className="rounded border p-2 text-xs mb-1">
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{c.team_name}</span>
                        <Badge variant="secondary" className="text-[10px]">{c.role === 'LARGEST' ? 'Maior equipe' : 'Demais'}</Badge>
                      </div>
                      <div className="text-muted-foreground">Antes {pts(c.points_available)} · Consumido {pts(c.points_consumed)} · Depois {pts(c.balance_after)}</div>
                    </div>
                  ))}
                  <div className="mt-3">
                    <Button size="sm" disabled variant="outline">
                      <Lock className="h-3.5 w-3.5 mr-1" /> Liberar crédito (pagamento desligado)
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* EQUIPES */}
        <TabsContent value="teams" className="mt-4">
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription className="text-sm">
              As equipes de cada parceiro são exibidas nos snapshots e no detalhamento de consumo. Total de equipes
              registradas: <strong>{pts(overview?.teams_total)}</strong> em <strong>{pts(overview?.partners_with_teams)}</strong> parceiros.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* CONSOLIDADO DE PARCEIROS */}
        <TabsContent value="consolidated" className="mt-4">
          <ExpansionPartnerPointsReport />
        </TabsContent>

        {/* INTEGRIDADE */}
        <TabsContent value="integrity" className="mt-4">
          <ExpansionIntegrityReport />
        </TabsContent>

        {/* COMUNICAÇÃO */}
        <TabsContent value="communication" className="mt-4">
          <ExpansionCommunicationPanel />
        </TabsContent>

        {/* CONSUMOS */}
        <TabsContent value="consumptions" className="mt-4 space-y-2">
          {snapshots.length === 0 && <p className="text-sm text-muted-foreground">Nenhum consumo registrado.</p>}
          {snapshots.flatMap((sp: any) => (sp.consumptions || []).map((c: any, i: number) => (
            <div key={`${sp.id}-${i}`} className="rounded border p-2 text-xs">
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="font-medium">{sp.partner_name}</span>
                <span className="text-muted-foreground">{dt(sp.period_start)} — {dt(sp.period_end)}</span>
              </div>
              <div className="text-muted-foreground">
                Equipe {c.team_name} ({c.role === 'LARGEST' ? 'maior' : 'demais'}) · Antes {pts(c.points_available)} · Consumido {pts(c.points_consumed)} · Depois {pts(c.balance_after)}
              </div>
            </div>
          )))}
        </TabsContent>

        {/* EXECUÇÕES */}
        <TabsContent value="runs" className="mt-4 space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>}
          {runs.map((r: any) => (
            <div key={r.id} className="rounded border p-3 text-xs space-y-1">
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="font-medium">{dt(r.period_start)} — {dt(r.period_end)}</span>
                <Badge variant={r.error_count > 0 ? 'destructive' : 'secondary'} className="text-[10px]">{r.status}</Badge>
              </div>
              <div className="text-muted-foreground">
                Início {dtt(r.started_at)} · Término {dtt(r.finished_at)} · Origem {r.origin} · Admin {r.admin_name || '—'}
              </div>
              <div className="text-muted-foreground">
                Processados {r.processed_count ?? 0} · Fechados {r.closed_count ?? 0} · Já fechados {r.already_closed_count ?? 0} · Sem volume {r.no_volume_count ?? 0} · Erros {r.error_count ?? 0}
              </div>
              {r.reason && <div>Motivo: {r.reason}</div>}
              {r.error_message && <div className="text-destructive">{r.error_message}</div>}
            </div>
          ))}
        </TabsContent>

        {/* AJUSTES E REVERSÕES */}
        <TabsContent value="adjustments" className="mt-4 space-y-2">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Somente visualização. Saldos não podem ser alterados manualmente — toda correção usa as funções
              oficiais e gera auditoria.
            </AlertDescription>
          </Alert>
          {adjustments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ajuste ou reversão registrado.</p>}
          {adjustments.map((a: any) => (
            <div key={a.id} className="rounded border p-2 text-xs space-y-0.5">
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="font-medium">{a.partner_name}</span>
                <Badge variant="outline" className="text-[10px]">{a.kind === 'REVERSAL' ? 'Reversão' : 'Ajuste'}</Badge>
              </div>
              <div className="text-muted-foreground">
                {dtt(a.created_at)} · {pts(a.points)} pts · origem {a.source} · status {a.status}
                {a.reverses_id ? ' · reverte evento anterior' : ''}
              </div>
              {a.reason && <div>Motivo: {a.reason}</div>}
              {a.admin_name && <div>Responsável: {a.admin_name}</div>}
            </div>
          ))}
        </TabsContent>

        {/* CONFIGURAÇÕES */}
        <TabsContent value="settings" className="mt-4 space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-1">
              <div>Alterações valem apenas para fechamentos futuros.</div>
              <div>Snapshots já fechados preservam o percentual, plano e teto utilizados na época.</div>
              <div>Ativar o fechamento não ativa automaticamente o pagamento.</div>
              <div>Ativar o pagamento não libera nada retroativamente — a liberação é sempre uma ação controlada.</div>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4" /> Parâmetros</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Percentual do bônus (%)</Label>
                  <Input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <Label>Data oficial de início</Label>
                  <Input type="date" value={officialStart ? officialStart.slice(0, 10) : ''} onChange={(e) => setOfficialStart(e.target.value)} />
                </div>
                {PLANS.map((p) => (
                  <div key={p}>
                    <Label>Teto semanal {p} (R$)</Label>
                    <Input value={caps[p] ?? ''} onChange={(e) => setCaps({ ...caps, [p]: e.target.value })} inputMode="decimal" />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="text-sm font-medium">Fechamento automático semanal</p>
                  <p className="text-xs text-muted-foreground">Executa o fechamento das semanas encerradas.</p>
                </div>
                <Switch checked={closeEnabled} onCheckedChange={setCloseEnabled} />
              </div>
              <div className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="text-sm font-medium">Pagamento do bônus</p>
                  <p className="text-xs text-muted-foreground">Permite a liberação financeira dos fechamentos.</p>
                </div>
                <Switch checked={payoutEnabled} onCheckedChange={setPayoutEnabled} />
              </div>

              <div>
                <Label>Motivo da alteração</Label>
                <Textarea value={settingsReason} onChange={(e) => setSettingsReason(e.target.value)} placeholder="Registrado na auditoria" />
              </div>
              <Button onClick={saveSettings} disabled={saving}>{saving ? 'Salvando…' : 'Salvar configurações'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDITORIA */}
        <TabsContent value="audit" className="mt-4 space-y-2">
          {audit.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro de auditoria.</p>}
          {audit.map((a: any) => (
            <div key={a.id} className="rounded border p-2 text-xs space-y-0.5">
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="font-medium">{a.action}</span>
                <span className="text-muted-foreground">{dtt(a.created_at)}</span>
              </div>
              <div className="text-muted-foreground">Admin: {a.admin_name || '—'} · Alvo: {a.target_type} {a.target_id}</div>
              {a.reason && <div>Motivo: {a.reason}</div>}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
