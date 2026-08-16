import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Settings2, Sparkles, Tag, Package, ShoppingBag, Home, ArrowLeft,
  Sliders, CalendarClock, Braces, Info, Lightbulb, ShieldCheck, Rocket,
  CheckCircle2, XCircle, Clock, AlertTriangle, Trophy, Gift,
} from "lucide-react";

const sb = supabase as any;

type SettingRow = { key: string; value: any };

// ============ Dicionário de tradução amigável ============
const FRIENDLY: Record<string, { label: string; help: string }> = {
  // Bool
  points_program_enabled: { label: "Programa Pontos ligado", help: "Chave mestra. Se estiver desligada, nada acontece com pontos, mesmo com outras opções ativas." },
  points_accrual_enabled: { label: "Acúmulo de pontos ativo", help: "Quando ligada, cada lance pago elegível começa a gerar pontos após a data de corte." },
  points_store_enabled: { label: "Loja Show visível", help: "Quando ligada, os usuários enxergam a loja e podem navegar pelos prêmios." },
  points_redemption_enabled: { label: "Resgates permitidos", help: "Quando ligada, o usuário pode trocar pontos por prêmios. Se desligar, a loja aparece mas o botão de resgate fica bloqueado." },
  points_reversal_enabled: { label: "Reversão automática ativa", help: "Permite estornar pontos quando um pagamento é cancelado/chargeback." },
  points_webhook_v2_enabled: { label: "Webhooks v2 (canônicos)", help: "Usa a rota nova de crédito de lances pagos. Deve ficar sempre ligada." },
  points_admin_only_write: { label: "Somente admin altera catálogo", help: "Protege categorias e itens contra escrita por usuários comuns." },
  points_center_visible: { label: "Central visível no painel do usuário", help: "Mostra ou esconde o widget de pontos na área do usuário." },
  // Num
  points_min_redeem: { label: "Mínimo de pontos para resgatar", help: "Quantidade mínima de pontos que o usuário precisa ter para conseguir trocar por um prêmio." },
  points_max_daily_redeem: { label: "Limite diário de resgates por usuário", help: "Quantos resgates uma mesma pessoa pode fazer em 24 horas." },
  points_ledger_retention_days: { label: "Retenção do histórico (dias)", help: "Por quantos dias mantemos o extrato detalhado de pontos." },
  points_reversal_grace_hours: { label: "Janela de reversão (horas)", help: "Tempo em que uma reversão é aceita automaticamente após o crédito." },
  // Time
  points_accrual_started_at: { label: "Data e hora de corte", help: "Marco zero. Só lances pagos confirmados APÓS este momento contam para pontos. Nada retroativo." },
  points_store_launched_at: { label: "Data de lançamento da loja", help: "Data em que a loja abriu para o público (apenas informativa)." },
  // JSON
  points_audience_config: { label: "Configuração de audiência", help: "Define quem participa: 'all' (todos autenticados) ou 'pilot' (lista específica de UUIDs)." },
  points_eligible_auctions: { label: "Leilões elegíveis", help: "'all' para todos, ou lista de IDs de leilões específicos." },
  points_notifications_config: { label: "Configuração de notificações", help: "Canais e templates para avisar o usuário sobre acúmulo e resgates." },
};

function humanize(key: string) {
  const f = FRIENDLY[key];
  if (f) return f.label;
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function helpOf(key: string) {
  return FRIENDLY[key]?.help ?? "Configuração técnica avançada. Altere apenas se souber o efeito.";
}

// ============ Hook de settings ============
function useSettings() {
  const [bools, setBools] = useState<SettingRow[]>([]);
  const [nums, setNums] = useState<SettingRow[]>([]);
  const [times, setTimes] = useState<SettingRow[]>([]);
  const [jsons, setJsons] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [b, n, t, j] = await Promise.all([
      sb.from("points_program_settings_bool").select("key,value"),
      sb.from("points_program_settings_num").select("key,value"),
      sb.from("points_program_settings_time").select("key,value"),
      sb.from("points_program_settings_json").select("key,value"),
    ]);
    setBools(b.data || []);
    setNums(n.data || []);
    setTimes(t.data || []);
    setJsons(j.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { bools, nums, times, jsons, loading, reload };
}

// ============ Configurações ============
function ConfigTab() {
  const { bools, nums, times, jsons, loading, reload } = useSettings();
  const [saving, setSaving] = useState<string | null>(null);

  const update = async (table: string, key: string, value: any) => {
    setSaving(key);
    const { error } = await sb.from(table).update({ value }).eq("key", key);
    if (error) toast.error(`Erro: ${error.message}`);
    else { toast.success("Alteração salva com sucesso"); await reload(); }
    setSaving(null);
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  const activeBools = bools.filter(b => b.value).length;

  return (
    <div className="space-y-6">
      <Alert className="border-warning/40 bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">Atenção: mudanças entram no ar imediatamente</AlertTitle>
        <AlertDescription>
          Cada alteração nesta aba impacta o sistema em tempo real. Se estiver em dúvida, mantenha as flags como estão.
          Atualmente <b>{activeBools}</b> de <b>{bools.length}</b> chaves estão ativas.
        </AlertDescription>
      </Alert>

      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            <CardTitle>Chaves de ativação (liga/desliga)</CardTitle>
          </div>
          <CardDescription>
            Cada linha é um interruptor de uma funcionalidade do programa. Verde = ligado. Cinza = desligado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {bools.map(r => (
            <div key={r.key} className="flex items-start justify-between gap-3 border rounded-lg p-4 hover:bg-muted/40 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">{humanize(r.key)}</div>
                <p className="text-xs text-muted-foreground mt-1">{helpOf(r.key)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={r.value ? "default" : "secondary"} className={r.value ? "bg-success text-success-foreground" : ""}>
                    {r.value ? "ATIVA" : "DESATIVADA"}
                  </Badge>
                  <code className="text-[10px] text-muted-foreground">{r.key}</code>
                </div>
              </div>
              <Switch
                checked={!!r.value}
                disabled={saving === r.key}
                onCheckedChange={(v) => update("points_program_settings_bool", r.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-accent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <CardTitle>Parâmetros numéricos</CardTitle>
          </div>
          <CardDescription>Limites e quantidades que regulam o programa.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {nums.map(r => (
            <NumEditor key={r.key} row={r} onSave={(v) => update("points_program_settings_num", r.key, v)} disabled={saving === r.key} />
          ))}
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-warning">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-warning" />
            <CardTitle>Datas importantes</CardTitle>
          </div>
          <CardDescription>Marcos que definem quando funcionalidades começam a valer.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {times.map(r => (
            <TimeEditor key={r.key} row={r} onSave={(v) => update("points_program_settings_time", r.key, v)} disabled={saving === r.key} />
          ))}
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-muted-foreground">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Braces className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Configurações avançadas (JSON)</CardTitle>
          </div>
          <CardDescription>Somente para uso técnico. Um erro de formato bloqueia o salvamento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jsons.map(r => (
            <JsonEditor key={r.key} row={r} onSave={(v) => update("points_program_settings_json", r.key, v)} disabled={saving === r.key} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function NumEditor({ row, onSave, disabled }: { row: SettingRow; onSave: (v: number) => void; disabled: boolean }) {
  const [v, setV] = useState(String(row.value ?? ""));
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div>
        <Label className="font-semibold text-sm">{humanize(row.key)}</Label>
        <p className="text-xs text-muted-foreground">{helpOf(row.key)}</p>
      </div>
      <div className="flex items-end gap-2">
        <Input type="number" value={v} onChange={e => setV(e.target.value)} />
        <Button size="sm" disabled={disabled} onClick={() => onSave(Number(v))}>Salvar</Button>
      </div>
      <code className="text-[10px] text-muted-foreground">{row.key}</code>
    </div>
  );
}
function TimeEditor({ row, onSave, disabled }: { row: SettingRow; onSave: (v: string | null) => void; disabled: boolean }) {
  const [v, setV] = useState(row.value ? new Date(row.value).toISOString().slice(0, 16) : "");
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div>
        <Label className="font-semibold text-sm">{humanize(row.key)}</Label>
        <p className="text-xs text-muted-foreground">{helpOf(row.key)}</p>
      </div>
      <div className="flex items-end gap-2">
        <Input type="datetime-local" value={v} onChange={e => setV(e.target.value)} />
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onSave(null)}>Limpar</Button>
        <Button size="sm" disabled={disabled || !v} onClick={() => onSave(new Date(v).toISOString())}>Salvar</Button>
      </div>
      <code className="text-[10px] text-muted-foreground">{row.key}</code>
    </div>
  );
}
function JsonEditor({ row, onSave, disabled }: { row: SettingRow; onSave: (v: any) => void; disabled: boolean }) {
  const [v, setV] = useState(JSON.stringify(row.value, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <Label className="font-semibold text-sm">{humanize(row.key)}</Label>
      <p className="text-xs text-muted-foreground">{helpOf(row.key)}</p>
      <Textarea rows={5} value={v} onChange={e => { setV(e.target.value); setErr(null); }} className="font-mono text-xs" />
      {err && <p className="text-xs text-destructive">Formato inválido: {err}</p>}
      <div className="flex justify-between items-center">
        <code className="text-[10px] text-muted-foreground">{row.key}</code>
        <Button size="sm" disabled={disabled} onClick={() => {
          try { onSave(JSON.parse(v)); } catch (e: any) { setErr(e.message); }
        }}>Salvar</Button>
      </div>
    </div>
  );
}

// ============ Regras ============
function RulesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    rule_code: "POINTS_STANDARD",
    version: 1,
    name: "",
    bids_per_point: 12,
    points_per_block: 1,
    multiplier: 1,
    is_active: false,
  });
  const [activating, setActivating] = useState<string | null>(null);
  const [activateOpen, setActivateOpen] = useState<any | null>(null);
  const [activateForm, setActivateForm] = useState({
    cutoff: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    audience_mode: "all",
    user_ids: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("points_rules").select("*").order("created_at", { ascending: false });
    setRows(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const nextVersion = () => {
    const same = rows.filter(r => r.rule_code === form.rule_code);
    return same.length ? Math.max(...same.map(r => r.version || 1)) + 1 : 1;
  };

  const save = async () => {
    const payload = { ...form, version: form.version || nextVersion() };
    const { error } = await sb.from("points_rules").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Regra criada (inativa). Ative quando estiver pronta."); setOpen(false); await load(); }
  };

  const activate = async () => {
    if (!activateOpen) return;
    setActivating(activateOpen.id);
    const userIds = activateForm.user_ids
      .split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    const { data, error } = await sb.rpc("points_admin_activate_pilot", {
      p_rule_id: activateOpen.id,
      p_cutoff: new Date(activateForm.cutoff).toISOString(),
      p_pilot_user_ids: userIds,
      p_audience_mode: activateForm.audience_mode,
    });
    if (error) toast.error(error.message);
    else { toast.success(`Programa ativado com sucesso!`); setActivateOpen(null); await load(); }
    setActivating(null);
  };

  return (
    <div className="space-y-4">
      <Alert className="border-primary/40 bg-primary/5">
        <Rocket className="h-4 w-4 text-primary" />
        <AlertTitle>Ativação atômica e segura</AlertTitle>
        <AlertDescription>
          Cada regra nasce <b>inativa</b>. Quando você clica em <b>Ativar</b>, o sistema aciona uma única transação que
          define a data de corte, a audiência, ativa os webhooks corretos e liga as chaves necessárias — tudo de uma vez,
          para evitar estados inconsistentes.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Regras de pontuação</CardTitle>
            <CardDescription>Ex.: 12 lances pagos elegíveis = 1 Ponto Show. Cada versão fica imutável no histórico.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setForm(f => ({ ...f, version: nextVersion() })); }}>
            <DialogTrigger asChild><Button><Sparkles className="h-4 w-4 mr-2" />Nova regra</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova regra de pontuação</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Código da regra</Label><Input value={form.rule_code} onChange={e => setForm({ ...form, rule_code: e.target.value })} /></div>
                <div><Label>Versão</Label><Input type="number" value={form.version} onChange={e => setForm({ ...form, version: Number(e.target.value) })} /></div>
                <div><Label>Nome amigável</Label><Input placeholder="Ex.: Padrão 12x1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Lances por bloco</Label><Input type="number" value={form.bids_per_point} onChange={e => setForm({ ...form, bids_per_point: Number(e.target.value) })} /></div>
                <div><Label>Pontos gerados por bloco</Label><Input type="number" value={form.points_per_block} onChange={e => setForm({ ...form, points_per_block: Number(e.target.value) })} /></div>
                <div><Label>Multiplicador (promoções)</Label><Input type="number" step="0.1" value={form.multiplier} onChange={e => setForm({ ...form, multiplier: Number(e.target.value) })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Criar (permanece inativa)</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Regra</TableHead>
                    <TableHead>Multiplicador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.rule_code}</TableCell>
                      <TableCell>v{r.version}</TableCell>
                      <TableCell>{r.name || "—"}</TableCell>
                      <TableCell><span className="font-medium">{r.bids_per_point}</span> lances = <span className="font-medium text-primary">{r.points_per_block} pt(s)</span></TableCell>
                      <TableCell>{r.multiplier}x</TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? "default" : "secondary"} className={r.is_active ? "bg-success text-success-foreground" : ""}>
                          {r.is_active ? "ATIVA" : "INATIVA"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!r.is_active && (
                          <Button size="sm" disabled={activating === r.id} onClick={() => setActivateOpen(r)}>
                            <Rocket className="h-3 w-3 mr-1" />Ativar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma regra cadastrada ainda.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!activateOpen} onOpenChange={(v) => { if (!v) setActivateOpen(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ativar {activateOpen?.rule_code} v{activateOpen?.version}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert className="border-warning/40 bg-warning/5">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription>
                Esta ação liga o programa em produção. Confirme a data de corte e a audiência.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Data e hora do corte</Label>
              <p className="text-xs text-muted-foreground mb-1">Apenas lances pagos confirmados depois deste momento gerarão pontos.</p>
              <Input type="datetime-local" value={activateForm.cutoff} onChange={e => setActivateForm({ ...activateForm, cutoff: e.target.value })} />
            </div>
            <div>
              <Label>Quem participa</Label>
              <select
                className="w-full border rounded px-3 py-2 bg-background mt-1"
                value={activateForm.audience_mode}
                onChange={e => setActivateForm({ ...activateForm, audience_mode: e.target.value })}
              >
                <option value="pilot">Piloto (apenas usuários da lista)</option>
                <option value="all">Todos os usuários autenticados</option>
              </select>
            </div>
            {activateForm.audience_mode === "pilot" && (
              <div>
                <Label>UUIDs dos usuários do piloto</Label>
                <p className="text-xs text-muted-foreground mb-1">Um por linha ou separados por vírgula.</p>
                <Textarea rows={4} value={activateForm.user_ids} onChange={e => setActivateForm({ ...activateForm, user_ids: e.target.value })} className="font-mono text-xs" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(null)}>Cancelar</Button>
            <Button disabled={!!activating} onClick={activate}>
              <Rocket className="h-4 w-4 mr-2" />Confirmar ativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Categorias ============
function CategoriesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("points_store_categories").select("*").order("sort_order");
    setRows(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.slug) return toast.error("Nome e slug são obrigatórios");
    const { error } = await sb.from("points_store_categories").insert(form);
    if (error) toast.error(error.message);
    else { toast.success("Categoria criada"); setForm({ name: "", slug: "", description: "" }); await load(); }
  };
  const toggle = async (id: string, active: boolean) => {
    await sb.from("points_store_categories").update({ is_active: active }).eq("id", id);
    await load();
  };

  return (
    <div className="space-y-4">
      <Alert className="border-accent/40 bg-accent/5">
        <Info className="h-4 w-4 text-accent" />
        <AlertDescription>
          Categorias organizam a loja. Ex.: <b>Eletrônicos</b>, <b>Casa</b>, <b>Cupons</b>. O <b>slug</b> é usado na URL e deve ser em minúsculo sem espaços.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-accent" />Nova categoria</CardTitle>
          <CardDescription>Preencha nome, slug e descrição opcional.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="Nome (ex.: Eletrônicos)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="slug-url (ex.: eletronicos)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
          <Input placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Button onClick={create}>Adicionar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Categorias cadastradas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Slug</TableHead><TableHead>Ativa</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.slug}</TableCell>
                      <TableCell><Switch checked={r.is_active} onCheckedChange={v => toggle(r.id, v)} /></TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhuma categoria criada.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Itens ============
function ItemsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const empty = { name: "", slug: "", short_description: "", cost_points: 100, stock_total: 0, category_id: "", main_image_url: "", status: "DRAFT" };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    setLoading(true);
    const [i, c] = await Promise.all([
      sb.from("points_store_items").select("*").order("created_at", { ascending: false }),
      sb.from("points_store_categories").select("id,name"),
    ]);
    setRows(i.data || []); setCats(c.data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload: any = { ...form };
    if (!payload.category_id) delete payload.category_id;
    const { error } = editing
      ? await sb.from("points_store_items").update(payload).eq("id", editing.id)
      : await sb.from("points_store_items").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Item atualizado" : "Item criado"); setOpen(false); setEditing(null); setForm(empty); await load(); }
  };

  const editItem = (item: any) => {
    setEditing(item);
    setForm({ ...empty, ...item });
    setOpen(true);
  };

  const adjustStock = async (id: string, delta: number) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    const newStock = row.stock_total + delta;
    if (newStock < row.stock_reserved) return toast.error("Estoque não pode ficar abaixo do reservado");
    const { error } = await sb.from("points_store_items").update({ stock_total: newStock }).eq("id", id);
    if (error) toast.error(error.message); else await load();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "ACTIVE": return "bg-success text-success-foreground";
      case "PAUSED": return "bg-warning text-warning-foreground";
      case "OUT_OF_STOCK": return "bg-destructive text-destructive-foreground";
      case "ARCHIVED": return "bg-muted text-muted-foreground";
      default: return "";
    }
  };

  const statusLabel = (s: string) => ({
    DRAFT: "Rascunho", ACTIVE: "Publicado", PAUSED: "Pausado",
    OUT_OF_STOCK: "Sem estoque", ARCHIVED: "Arquivado"
  } as any)[s] || s;

  return (
    <div className="space-y-4">
      <Alert className="border-primary/40 bg-primary/5">
        <Gift className="h-4 w-4 text-primary" />
        <AlertDescription>
          Aqui você monta o catálogo de prêmios. Só itens com status <b>Publicado</b> aparecem na Loja Show para o usuário.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Catálogo</CardTitle>
            <CardDescription>Prêmios que os usuários podem resgatar com pontos.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button><Package className="h-4 w-4 mr-2" />Novo item</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Descrição curta</Label><Textarea rows={2} value={form.short_description || ""} onChange={e => setForm({ ...form, short_description: e.target.value })} /></div>
                <div><Label>Custo (pontos)</Label><Input type="number" value={form.cost_points} onChange={e => setForm({ ...form, cost_points: Number(e.target.value) })} /></div>
                <div><Label>Estoque total</Label><Input type="number" value={form.stock_total} onChange={e => setForm({ ...form, stock_total: Number(e.target.value) })} /></div>
                <div>
                  <Label>Categoria</Label>
                  <select className="w-full border rounded px-3 py-2 bg-background" value={form.category_id || ""} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">— sem categoria —</option>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select className="w-full border rounded px-3 py-2 bg-background" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {["DRAFT", "ACTIVE", "PAUSED", "OUT_OF_STOCK", "ARCHIVED"].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <MainImageUploader value={form.main_image_url || ""} onChange={(url) => setForm({ ...form, main_image_url: url })} />
                </div>
                {editing && (
                  <div className="md:col-span-2 border-t pt-3">
                    <StoreItemImagesManager itemId={editing.id} onMainChange={(url) => setForm({ ...form, main_image_url: url })} />
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={save}>{editing ? "Salvar alterações" : "Criar item"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Custo</TableHead><TableHead>Estoque</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {r.main_image_url ? <img src={r.main_image_url} alt="" className="h-10 w-10 rounded object-cover border" /> : <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                          <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{r.slug}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><span className="font-semibold text-primary">{r.cost_points}</span> pts</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => adjustStock(r.id, -1)}>−</Button>
                          <span className="w-20 text-center text-sm"><b>{r.stock_available}</b>/{r.stock_total}</span>
                          <Button size="sm" variant="outline" onClick={() => adjustStock(r.id, 1)}>+</Button>
                        </div>
                      </TableCell>
                      <TableCell><Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => editItem(r)}>Editar</Button></TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum item no catálogo.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Resgates ============
function RedemptionsTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");

  const load = async () => {
    setLoading(true);
    let q = sb.from("points_redemptions").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter !== "ALL") q = q.eq("status", filter);
    const { data } = await q;
    setRows(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const approve = async (id: string) => {
    const { error } = await sb.rpc("redeem_approve", { p_redemption: id, p_admin: user?.id, p_notes: null });
    if (error) toast.error(error.message); else { toast.success("Resgate aprovado"); await load(); }
  };
  const reject = async (id: string) => {
    const reason = prompt("Motivo da rejeição:") || "sem motivo";
    const { error } = await sb.rpc("redeem_reject", { p_redemption: id, p_admin: user?.id, p_reason: reason });
    if (error) toast.error(error.message); else { toast.success("Resgate rejeitado"); await load(); }
  };

  const filters: Array<{ key: string; label: string; icon: any; className: string }> = [
    { key: "PENDING", label: "Pendentes", icon: Clock, className: "" },
    { key: "APPROVED", label: "Aprovados", icon: CheckCircle2, className: "" },
    { key: "REJECTED", label: "Rejeitados", icon: XCircle, className: "" },
    { key: "ALL", label: "Todos", icon: Trophy, className: "" },
  ];

  const statusBadge = (s: string) => {
    if (s === "APPROVED") return <Badge className="bg-success text-success-foreground">Aprovado</Badge>;
    if (s === "REJECTED") return <Badge variant="destructive">Rejeitado</Badge>;
    if (s === "PENDING") return <Badge className="bg-warning text-warning-foreground">Pendente</Badge>;
    return <Badge variant="secondary">{s}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Alert className="border-primary/40 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertDescription>
          Quando um usuário troca pontos por um prêmio, o pedido aparece aqui como <b>Pendente</b>. Você aprova (reserva o estoque)
          ou rejeita (devolve os pontos).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-primary" />Fila de resgates</CardTitle>
          <CardDescription>Filtre pelo status e tome as ações necessárias.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {filters.map(f => {
              const Icon = f.icon;
              return (
                <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
                  <Icon className="h-4 w-4 mr-1" />{f.label}
                </Button>
              );
            })}
          </div>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Usuário</TableHead><TableHead>Pontos</TableHead><TableHead>Status</TableHead><TableHead>Criado em</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.order_number}</TableCell>
                      <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TableCell>
                      <TableCell><span className="font-semibold text-primary">{r.total_points}</span> pts</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        {r.status === "PENDING" && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => approve(r.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Aprovar</Button>
                            <Button size="sm" variant="destructive" onClick={() => reject(r.id)}><XCircle className="h-4 w-4 mr-1" />Rejeitar</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum resgate encontrado neste filtro.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Página ============
export default function AdminPontosLoja() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !profile?.is_admin)) navigate("/dashboard");
  }, [authLoading, user, profile, navigate]);

  if (authLoading || !user || !profile?.is_admin) return <div className="p-6"><Skeleton className="h-96" /></div>;

  const tabs = [
    { value: "config", label: "Configurações", icon: Settings2 },
    { value: "rules", label: "Regras", icon: Sparkles },
    { value: "categories", label: "Categorias", icon: Tag },
    { value: "items", label: "Itens", icon: Package },
    { value: "redemptions", label: "Resgates", icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Hero */}
        <div className="rounded-2xl overflow-hidden border shadow-[var(--shadow-elegant)]">
          <div
            className="p-6 md:p-8 text-white"
            style={{ background: "var(--gradient-hero)" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-white/80 text-xs mb-2">
                  <Trophy className="h-4 w-4" />
                  <span>Painel Administrativo</span>
                </div>
                <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Pontos & Loja Show</h1>
                <p className="text-white/85 mt-2 max-w-2xl text-sm md:text-base">
                  Aqui você controla tudo do <b>Programa Pontos Show</b>: quando começa a valer, quanto vale cada lance,
                  o que está à venda e quem já pediu prêmio. Cada aba abaixo tem uma explicação didática antes das ações.
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/admin">
                  <Button variant="secondary" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />Voltar ao Admin
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
                    <Home className="h-4 w-4 mr-2" />Início
                  </Button>
                </Link>
              </div>
            </div>

            {/* Guia rápido */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
              <div className="rounded-lg bg-white/10 backdrop-blur px-4 py-3 border border-white/15">
                <div className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="h-4 w-4" />Como funciona</div>
                <p className="text-xs text-white/80 mt-1">Lances pagos elegíveis geram pontos após a data de corte. Ex.: 12 lances = 1 ponto.</p>
              </div>
              <div className="rounded-lg bg-white/10 backdrop-blur px-4 py-3 border border-white/15">
                <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Sem retroativo</div>
                <p className="text-xs text-white/80 mt-1">Nada do que aconteceu antes do corte vira ponto. Zero risco de dívida histórica.</p>
              </div>
              <div className="rounded-lg bg-white/10 backdrop-blur px-4 py-3 border border-white/15">
                <div className="flex items-center gap-2 text-sm font-semibold"><Rocket className="h-4 w-4" />Ativação segura</div>
                <p className="text-xs text-white/80 mt-1">O botão "Ativar" na aba Regras liga tudo de forma atômica: corte + audiência + webhooks.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de resumo das abas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <Card key={t.value} className="border-l-4 border-l-primary/70">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.value === "config" && "Chaves e parâmetros"}
                      {t.value === "rules" && "Fórmula de pontos"}
                      {t.value === "categories" && "Organização da loja"}
                      {t.value === "items" && "Catálogo de prêmios"}
                      {t.value === "redemptions" && "Aprovar pedidos"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="config" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="config"><ConfigTab /></TabsContent>
          <TabsContent value="rules"><RulesTab /></TabsContent>
          <TabsContent value="categories"><CategoriesTab /></TabsContent>
          <TabsContent value="items"><ItemsTab /></TabsContent>
          <TabsContent value="redemptions"><RedemptionsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
