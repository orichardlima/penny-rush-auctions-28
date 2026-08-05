import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Play, AlertCircle, Info, CheckCircle2, History, Plus, XCircle, ShieldAlert, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const sb = supabase as any;

type Version = {
  id: string;
  version_number: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'CANCELLED';
  effective_from: string;
  config_data: any[];
  config_hash: string | null;
  created_at: string;
  created_by: string | null;
  published_at: string | null;
  published_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  change_reason: string | null;
  dry_run_impact_snapshot: any;
};

const TZ = 'America/Bahia';

const fmtBahia = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${g('weekday')}, ${g('day')}/${g('month')}/${g('year')} às ${g('hour')}:${g('minute')}`;
  } catch {
    return '—';
  }
};

const fmtBahiaTechnical = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hour12: false,
    } as any).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${g('weekday')}, ${g('day')}/${g('month')}/${g('year')} às ${g('hour')}:${g('minute')}:${g('second')}.${g('fractionalSecond')}`;
  } catch {
    return '—';
  }
};

const isV1Baseline = (v: Version | null) => !!v && v.version_number === 1;

// Bahia é UTC-3 fixo (sem horário de verão)
const bahiaLocalToIso = (local: string) => new Date(`${local}:00-03:00`).toISOString();
const isBahiaMondayMidnight = (local: string) => {
  if (!local) return false;
  if (!local.endsWith('T00:00')) return false;
  const d = new Date(`${local}:00-03:00`);
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  return wd === 'Mon';
};

const friendlyError = (e: any) => {
  const msg = String(e?.message || e || '');
  if (/permission denied|Acesso negado|not authorized/i.test(msg)) return 'Acesso negado: apenas administradores podem executar esta ação.';
  if (/JWT|session|expired/i.test(msg)) return 'Sessão expirada. Faça login novamente.';
  if (/does not exist|function .* not found|schema cache/i.test(msg)) return 'Recurso administrativo indisponível no momento.';
  if (/segunda|monday|vig[êe]ncia|effective/i.test(msg)) return msg;
  return msg.replace(/\s*(CONTEXT|DETAIL|HINT):[\s\S]*/i, '').slice(0, 220) || 'Erro inesperado.';
};

const STATUS_LABEL = (v: Version, now: Date) => {
  if (v.status === 'DRAFT') return { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700 border-slate-300' };
  if (v.status === 'CANCELLED') return { label: 'Cancelada', cls: 'bg-red-50 text-red-700 border-red-300' };
  if (v.status === 'SUPERSEDED') return { label: 'Substituída', cls: 'bg-muted text-muted-foreground' };
  return new Date(v.effective_from) > now
    ? { label: 'Programada', cls: 'bg-blue-50 text-blue-700 border-blue-300' }
    : { label: 'Vigente', cls: 'bg-green-50 text-green-700 border-green-300' };
};

const emptyRank = {
  rank_key: '', rank_label: '', sort_order: 1, is_active: true,
  min_organizational_points: 0, min_qualified_teams: 0, max_team_concentration_pct: 0,
  min_active_partners_per_team: 1, min_qualified_team_points: 0, required_leaders: [] as any[],
};

export default function ExpansionCareerConfigTab() {
  const [loading, setLoading] = useState(true);
  const [permError, setPermError] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);

  const [draftForm, setDraftForm] = useState<any[] | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [effectiveLocal, setEffectiveLocal] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  const [simulating, setSimulating] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishedInfo, setPublishedInfo] = useState<any>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const now = new Date();

  const load = async () => {
    setLoading(true);
    setPermError(null);
    try {
      const { data, error } = await sb.rpc('expansion_admin_career_config_versions');
      if (error) throw error;
      setVersions((data || []) as Version[]);
    } catch (e: any) {
      setPermError(friendlyError(e));
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const current = useMemo(() => {
    const t = Date.now();
    return versions
      .filter((v) => (v.status === 'PUBLISHED' || v.status === 'SUPERSEDED') && new Date(v.effective_from).getTime() <= t)
      .sort((a, b) =>
        new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime() ||
        b.version_number - a.version_number)[0] || null;
  }, [versions]);

  const ranksOf = (v: Version | null) =>
    (v?.config_data || []).slice().sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

  const startDraft = () => {
    const base = ranksOf(current);
    setDraftForm(JSON.parse(JSON.stringify(base.length ? base : [emptyRank])));
    setChangeReason('');
    setEffectiveLocal('');
    setDraftId(null);
    setPreview(null);
    setPublishedInfo(null);
  };

  const updateRank = (idx: number, field: string, value: any) => {
    setDraftForm((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const normalized = () =>
    (draftForm || [])
      .slice()
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((r: any) => ({
        rank_key: String(r.rank_key || '').toUpperCase(),
        rank_label: r.rank_label,
        sort_order: Number(r.sort_order),
        is_active: !!r.is_active,
        min_organizational_points: Number(r.min_organizational_points),
        min_qualified_teams: Number(r.min_qualified_teams),
        max_team_concentration_pct: Number(r.max_team_concentration_pct),
        min_active_partners_per_team: Number(r.min_active_partners_per_team ?? 1),
        min_qualified_team_points: Number(r.min_qualified_team_points ?? 0),
        required_leaders: r.required_leaders || [],
      }));

  const saveDraft = async () => {
    if (!changeReason.trim()) return toast.error('Informe o motivo da mudança.');
    if (!effectiveLocal) return toast.error('Informe a data de vigência.');
    setSavingDraft(true);
    try {
      const { data, error } = await sb.rpc('expansion_admin_create_career_config_draft', {
        _config_data: normalized(),
        _effective_from: bahiaLocalToIso(effectiveLocal),
        _change_reason: changeReason.trim(),
      });
      if (error) throw error;
      setDraftId(data as string);
      setPreview(null);
      toast.success('Rascunho salvo.');
      await load();
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally {
      setSavingDraft(false);
    }
  };

  const runPreview = async (id?: string) => {
    const target = id || draftId;
    if (!target) return;
    setSimulating(true);
    setPreview(null);
    try {
      const { data, error } = await sb.rpc('expansion_admin_preview_config_impact', { _draft_id: target });
      if (error) throw error;
      setPreview(data);
      toast.success('Simulação concluída.');
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally {
      setSimulating(false);
    }
  };

  const previewApproved = useMemo(() => {
    if (!preview) return false;
    const s = preview.summary || {};
    return preview.stabilization_completed === true
      && preview.reconciles === true
      && Number(s.failures || 0) === 0
      && s.severity !== 'HIGH' && s.severity !== 'CRITICAL';
  }, [preview]);

  const canPublish = !!draftId && !!changeReason.trim() && previewApproved && !publishing;

  const publish = async () => {
    if (!canPublish || !draftId) return;
    setPublishing(true);
    try {
      const { data, error } = await sb.rpc('expansion_admin_publish_career_config', {
        _draft_id: draftId,
        _change_reason: changeReason.trim(),
      });
      if (error) throw error;
      setPublishedInfo(data);
      setDraftId(null);
      setDraftForm(null);
      setPreview(null);
      setChangeReason('');
      setEffectiveLocal('');
      toast.success('Versão publicada.');
      await load();
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally {
      setPublishing(false);
    }
  };

  const cancelVersion = async (v: Version) => {
    const reason = window.prompt('Informe o motivo do cancelamento:')?.trim();
    if (!reason) return toast.error('Motivo obrigatório para cancelar.');
    setCancellingId(v.id);
    try {
      const { error } = await sb.rpc('expansion_admin_cancel_career_config', { _version_id: v.id, _reason: reason });
      if (error) throw error;
      if (draftId === v.id) { setDraftId(null); setPreview(null); }
      toast.success('Versão cancelada.');
      await load();
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally {
      setCancellingId(null);
    }
  };

  const canCancel = (v: Version) =>
    v.status === 'DRAFT' || (v.status === 'PUBLISHED' && new Date(v.effective_from) > now);

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (permError) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso indisponível</AlertTitle>
        <AlertDescription className="text-xs">{permError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold">Configuração de Carreira</h3>
          <p className="text-sm text-muted-foreground">Backend versionado — configurações imutáveis com vigência programada.</p>
        </div>
        {!draftForm && (
          <Button size="sm" onClick={startDraft}><Plus className="h-4 w-4 mr-2" />Criar nova versão</Button>
        )}
      </div>

      {versions.length === 0 && (
        <Alert><Info className="h-4 w-4" /><AlertTitle>Nenhuma versão encontrada</AlertTitle>
          <AlertDescription className="text-xs">Nenhuma configuração versionada foi localizada.</AlertDescription></Alert>
      )}

      {publishedInfo && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Publicação concluída</AlertTitle>
          <AlertDescription className="text-green-700 text-xs">
            Versão publicada. Entrará em vigor em {fmtBahia(publishedInfo.effective_from)} (America/Bahia).
          </AlertDescription>
        </Alert>
      )}

      {/* CONFIGURAÇÃO VIGENTE */}
      {current && (
        <Card className="border-green-200">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base">
                  {isV1Baseline(current)
                    ? 'V1 — Baseline histórico da semana de 27/07/2026'
                    : `Configuração vigente — Versão ${current.version_number}`}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isV1Baseline(current)
                    ? `Vigência técnica: ${fmtBahiaTechnical(current.effective_from)} — America/Bahia`
                    : `Vigência: ${fmtBahia(current.effective_from)} · Publicada em: ${fmtBahia(current.published_at)}`}
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">{current.status === 'SUPERSEDED' ? 'Vigente (Substituída)' : 'Vigente'}</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground space-y-0.5 pt-2">
              {isV1Baseline(current) && (
                <div className="italic text-amber-700">
                  Baseline definido imediatamente antes do primeiro corte histórico para garantir cobertura integral das avaliações iniciais.
                </div>
              )}
              <div>Hash: <span className="font-mono break-all">{current.config_hash || '—'}</span></div>
              <div>Motivo: {current.change_reason || '—'}</div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ranksOf(current).map((r: any) => (
              <div key={r.rank_key} className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">{r.rank_key}</Badge>
                    <span className="font-semibold text-sm">{r.rank_label}</span>
                  </div>
                  {!r.is_active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><div className="text-[10px] uppercase text-muted-foreground">Pontos</div><div className="font-bold">{Number(r.min_organizational_points).toLocaleString('pt-BR')}</div></div>
                  <div><div className="text-[10px] uppercase text-muted-foreground">Equipes</div><div className="font-bold">{r.min_qualified_teams}</div></div>
                  <div><div className="text-[10px] uppercase text-muted-foreground">Concentração</div><div className="font-bold">{r.max_team_concentration_pct}%</div></div>
                  <div><div className="text-[10px] uppercase text-muted-foreground">Líderes exigidos</div><div className="font-bold">
                    {(r.required_leaders || []).length === 0 ? 'Nenhum'
                      : (r.required_leaders || []).map((l: any, i: number) => (
                        <span key={i}>{l.count} {l.rank}{l.distinct_teams ? ' (equipes distintas)' : ''}{i < r.required_leaders.length - 1 ? ', ' : ''}</span>
                      ))}
                  </div></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* RASCUNHO */}
      {draftForm && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              {draftId ? 'Rascunho salvo' : 'Rascunho não salvo'}
            </CardTitle>
            <CardDescription className="text-xs">
              Baseado na versão vigente. Ajuste os valores, informe motivo e vigência (segunda-feira às 00:00, America/Bahia).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {draftForm.map((r: any, idx: number) => (
                <div key={r.rank_key || idx} className="rounded-md border bg-background p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{r.rank_key}</Badge>
                      <Input value={r.rank_label} onChange={(e) => updateRank(idx, 'rank_label', e.target.value)}
                        className="h-8 w-48 font-semibold" disabled={!!draftId} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Ativa</Label>
                      <Switch checked={!!r.is_active} onCheckedChange={(v) => updateRank(idx, 'is_active', v)} disabled={!!draftId} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Pontos exigidos</Label>
                      <Input type="number" className="h-8" value={r.min_organizational_points} disabled={!!draftId}
                        onChange={(e) => updateRank(idx, 'min_organizational_points', Number(e.target.value))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Equipes qualificadas</Label>
                      <Input type="number" className="h-8" value={r.min_qualified_teams} disabled={!!draftId}
                        onChange={(e) => updateRank(idx, 'min_qualified_teams', Number(e.target.value))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Concentração máxima (%)</Label>
                      <Input type="number" className="h-8" value={r.max_team_concentration_pct} disabled={!!draftId}
                        onChange={(e) => updateRank(idx, 'max_team_concentration_pct', Number(e.target.value))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Parceiros ativos/equipe</Label>
                      <Input type="number" className="h-8" value={r.min_active_partners_per_team} disabled={!!draftId}
                        onChange={(e) => updateRank(idx, 'min_active_partners_per_team', Number(e.target.value))} /></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Motivo da mudança *</Label>
                <Input value={changeReason} onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Ex: Ajuste das exigências da graduação Prata" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vigência (America/Bahia) *</Label>
                <Input type="datetime-local" value={effectiveLocal} disabled={!!draftId}
                  onChange={(e) => setEffectiveLocal(e.target.value)} />
                <p className={`text-[11px] ${effectiveLocal && !isBahiaMondayMidnight(effectiveLocal) ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {effectiveLocal
                    ? `${fmtBahia(bahiaLocalToIso(effectiveLocal))}${isBahiaMondayMidnight(effectiveLocal) ? '' : ' — deve ser segunda-feira às 00:00'}`
                    : 'Selecione uma segunda-feira às 00:00.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!draftId && (
                <>
                  <Button size="sm" onClick={saveDraft} disabled={savingDraft}>
                    {savingDraft ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Salvar rascunho
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setDraftForm(null); setPreview(null); }}>Descartar</Button>
                </>
              )}
              {draftId && (
                <>
                  <Button size="sm" variant="outline" onClick={() => runPreview()} disabled={simulating}>
                    {simulating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    {simulating ? 'Simulando...' : 'Simular impacto'}
                  </Button>
                  <Button size="sm" onClick={publish} disabled={!canPublish}>
                    {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {publishing ? 'Publicando...' : (preview && !previewApproved ? 'Publicação bloqueada' : 'Publicar versão')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setDraftForm(null); setDraftId(null); setPreview(null); }}>Fechar</Button>
                </>
              )}
            </div>

            {preview && (
              <div className={`rounded-md border p-3 space-y-3 bg-background ${previewApproved ? 'border-green-300' : 'border-red-300'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Simulação bottom-up (sem gravação)</span>
                  <Badge className={previewApproved ? 'bg-green-600' : 'bg-red-600'}>{previewApproved ? 'APROVADO' : 'BLOQUEADO'}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    ['Encontrados', preview.summary?.found],
                    ['Elegíveis', preview.summary?.eligible],
                    ['Excluídos', preview.summary?.excluded],
                    ['Avaliados', preview.summary?.evaluated],
                    ['Falhas', preview.summary?.failures],
                    ['Promoções', preview.summary?.promotions_count],
                    ['Rebaixamentos', preview.summary?.downgrades_count],
                    ['Severidade', preview.summary?.severity],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                      <div className="font-bold">{String(v ?? 0)}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Iterações de estabilização: {preview.stabilization_iterations ?? '—'} ·
                  {' '}Estabilizou: {preview.stabilization_completed ? 'sim' : 'não'} ·
                  {' '}Reconcilia: {preview.reconciles ? 'sim' : 'não'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* HISTÓRICO */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2"><History className="h-4 w-4" />Histórico de configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {versions.slice().sort((a, b) => b.version_number - a.version_number).map((v) => {
            const st = STATUS_LABEL(v, now);
            const snap = v.dry_run_impact_snapshot?.summary || v.dry_run_impact_snapshot;
            return (
              <div key={v.id} className="rounded-md border p-3 text-xs space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">Versão {v.version_number}</span>
                    <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {v.status === 'DRAFT' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setDraftId(v.id); setDraftForm(JSON.parse(JSON.stringify(v.config_data || []))); setChangeReason(v.change_reason || ''); setPreview(null); }}>
                        Abrir rascunho
                      </Button>
                    )}
                    {canCancel(v) && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600"
                        onClick={() => cancelVersion(v)} disabled={cancellingId === v.id}>
                        {cancellingId === v.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                        {cancellingId === v.id ? 'Cancelando...' : 'Cancelar versão'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-muted-foreground">Vigência: {fmtBahia(v.effective_from)}</div>
                <div className="text-muted-foreground">Criada em: {fmtBahia(v.created_at)} · Publicada em: {fmtBahia(v.published_at)}</div>
                <div className="text-muted-foreground">Motivo: {v.change_reason || '—'}</div>
                <div className="text-muted-foreground break-all">Hash: <span className="font-mono">{v.config_hash || '—'}</span></div>
                {snap && (
                  <div className="text-muted-foreground">
                    Preview: avaliados {snap.evaluated ?? '—'} · promoções {snap.promotions_count ?? '—'} · rebaixamentos {snap.downgrades_count ?? '—'} · severidade {snap.severity ?? '—'}
                  </div>
                )}
                {v.status === 'CANCELLED' && (
                  <div className="text-red-600">Cancelada em {fmtBahia(v.cancelled_at)} — {v.cancellation_reason || 'sem motivo'}</div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* LEGADO */}
      <Card className="opacity-80">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-bold">Configuração legada — somente histórico</CardTitle>
          <CardDescription className="text-xs">
            A tabela legada do antigo sistema binário não é mais utilizada como fonte operacional da carreira. Sem edição, publicação ou simulação.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
