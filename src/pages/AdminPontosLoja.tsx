import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const sb = supabase as any;

type SettingRow = { setting_key: string; setting_value: any };

function useSettings() {
  const [bools, setBools] = useState<SettingRow[]>([]);
  const [nums, setNums] = useState<SettingRow[]>([]);
  const [times, setTimes] = useState<SettingRow[]>([]);
  const [jsons, setJsons] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [b, n, t, j] = await Promise.all([
      sb.from("points_program_settings_bool").select("setting_key,setting_value"),
      sb.from("points_program_settings_num").select("setting_key,setting_value"),
      sb.from("points_program_settings_time").select("setting_key,setting_value"),
      sb.from("points_program_settings_json").select("setting_key,setting_value"),
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

function ConfigTab() {
  const { bools, nums, times, jsons, loading, reload } = useSettings();
  const [saving, setSaving] = useState<string | null>(null);

  const update = async (table: string, key: string, value: any) => {
    setSaving(key);
    const { error } = await sb.from(table).update({ setting_value: value }).eq("setting_key", key);
    if (error) toast.error(`Erro: ${error.message}`);
    else { toast.success("Salvo"); await reload(); }
    setSaving(null);
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTitle>Cuidado</AlertTitle>
        <AlertDescription>
          Alterar essas flags impacta imediatamente o comportamento do sistema de pontos. Mantenha todas em <code>false</code> até liberação oficial.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle>Feature Flags</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {bools.map(r => (
            <div key={r.setting_key} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-mono text-sm">{r.setting_key}</div>
                <Badge variant={r.setting_value ? "default" : "secondary"} className="mt-1">
                  {r.setting_value ? "ATIVA" : "DESATIVADA"}
                </Badge>
              </div>
              <Switch
                checked={!!r.setting_value}
                disabled={saving === r.setting_key}
                onCheckedChange={(v) => update("points_program_settings_bool", r.setting_key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Parâmetros numéricos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {nums.map(r => (
            <NumEditor key={r.setting_key} row={r} onSave={(v) => update("points_program_settings_num", r.setting_key, v)} disabled={saving === r.setting_key} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Datas de corte</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {times.map(r => (
            <TimeEditor key={r.setting_key} row={r} onSave={(v) => update("points_program_settings_time", r.setting_key, v)} disabled={saving === r.setting_key} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Configurações JSON</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {jsons.map(r => (
            <JsonEditor key={r.setting_key} row={r} onSave={(v) => update("points_program_settings_json", r.setting_key, v)} disabled={saving === r.setting_key} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function NumEditor({ row, onSave, disabled }: { row: SettingRow; onSave: (v: number) => void; disabled: boolean }) {
  const [v, setV] = useState(String(row.setting_value ?? ""));
  return (
    <div className="flex items-end gap-2 border rounded p-3">
      <div className="flex-1">
        <Label className="font-mono text-xs">{row.setting_key}</Label>
        <Input type="number" value={v} onChange={e => setV(e.target.value)} />
      </div>
      <Button size="sm" disabled={disabled} onClick={() => onSave(Number(v))}>Salvar</Button>
    </div>
  );
}
function TimeEditor({ row, onSave, disabled }: { row: SettingRow; onSave: (v: string | null) => void; disabled: boolean }) {
  const [v, setV] = useState(row.setting_value ? new Date(row.setting_value).toISOString().slice(0, 16) : "");
  return (
    <div className="flex items-end gap-2 border rounded p-3">
      <div className="flex-1">
        <Label className="font-mono text-xs">{row.setting_key}</Label>
        <Input type="datetime-local" value={v} onChange={e => setV(e.target.value)} />
      </div>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => onSave(null)}>Limpar</Button>
      <Button size="sm" disabled={disabled || !v} onClick={() => onSave(new Date(v).toISOString())}>Salvar</Button>
    </div>
  );
}
function JsonEditor({ row, onSave, disabled }: { row: SettingRow; onSave: (v: any) => void; disabled: boolean }) {
  const [v, setV] = useState(JSON.stringify(row.setting_value, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="border rounded p-3 space-y-2">
      <Label className="font-mono text-xs">{row.setting_key}</Label>
      <Textarea rows={5} value={v} onChange={e => { setV(e.target.value); setErr(null); }} className="font-mono text-xs" />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex justify-end">
        <Button size="sm" disabled={disabled} onClick={() => {
          try { onSave(JSON.parse(v)); } catch (e: any) { setErr(e.message); }
        }}>Salvar</Button>
      </div>
    </div>
  );
}

// ------------------------ Regras ------------------------
function RulesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", bids_per_point: 12, multiplier: 1, is_active: true });

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("points_rules").select("*").order("created_at", { ascending: false });
    setRows(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { error } = await sb.from("points_rules").insert(form);
    if (error) toast.error(error.message);
    else { toast.success("Regra criada"); setOpen(false); await load(); }
  };
  const toggle = async (id: string, active: boolean) => {
    await sb.from("points_rules").update({ is_active: active }).eq("id", id);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Cada regra define a razão de lances pagos elegíveis por ponto acumulado.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Nova regra</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova regra de pontuação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Lances por ponto</Label><Input type="number" value={form.bids_per_point} onChange={e => setForm({ ...form, bids_per_point: Number(e.target.value) })} /></div>
              <div><Label>Multiplicador</Label><Input type="number" step="0.1" value={form.multiplier} onChange={e => setForm({ ...form, multiplier: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>Ativa</Label></div>
            </div>
            <DialogFooter><Button onClick={save}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Lances/Ponto</TableHead><TableHead>Multiplicador</TableHead><TableHead>Vigência</TableHead><TableHead>Ativa</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.bids_per_point}</TableCell>
                <TableCell>{r.multiplier}</TableCell>
                <TableCell className="text-xs">{new Date(r.active_from).toLocaleDateString("pt-BR")}{r.active_to ? ` → ${new Date(r.active_to).toLocaleDateString("pt-BR")}` : ""}</TableCell>
                <TableCell><Switch checked={r.is_active} onCheckedChange={v => toggle(r.id, v)} /></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma regra cadastrada</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ------------------------ Categorias ------------------------
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
    if (!form.name || !form.slug) return toast.error("Nome e slug obrigatórios");
    const { error } = await sb.from("points_store_categories").insert(form);
    if (error) toast.error(error.message);
    else { toast.success("Criada"); setForm({ name: "", slug: "", description: "" }); await load(); }
  };
  const toggle = async (id: string, active: boolean) => {
    await sb.from("points_store_categories").update({ is_active: active }).eq("id", id);
    await load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Nova categoria</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="slug-url" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
          <Input placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Button onClick={create}>Adicionar</Button>
        </CardContent>
      </Card>
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Slug</TableHead><TableHead>Ativa</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="font-mono text-xs">{r.slug}</TableCell>
                <TableCell><Switch checked={r.is_active} onCheckedChange={v => toggle(r.id, v)} /></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhuma categoria</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ------------------------ Itens ------------------------
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
    else { toast.success(editing ? "Atualizado" : "Criado"); setOpen(false); setEditing(null); setForm(empty); await load(); }
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">Catálogo de recompensas resgatáveis com pontos.</p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button>Novo item</Button></DialogTrigger>
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
                  {["DRAFT", "ACTIVE", "PAUSED", "OUT_OF_STOCK", "ARCHIVED"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="md:col-span-2"><Label>URL imagem principal</Label><Input value={form.main_image_url || ""} onChange={e => setForm({ ...form, main_image_url: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Custo</TableHead><TableHead>Estoque</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.cost_points} pts</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => adjustStock(r.id, -1)}>-</Button>
                    <span className="w-16 text-center">{r.stock_available}/{r.stock_total}</span>
                    <Button size="sm" variant="outline" onClick={() => adjustStock(r.id, 1)}>+</Button>
                  </div>
                </TableCell>
                <TableCell><Badge variant={r.status === "ACTIVE" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => editItem(r)}>Editar</Button></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum item</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ------------------------ Resgates ------------------------
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
    if (error) toast.error(error.message); else { toast.success("Aprovado"); await load(); }
  };
  const reject = async (id: string) => {
    const reason = prompt("Motivo da rejeição:") || "sem motivo";
    const { error } = await sb.rpc("redeem_reject", { p_redemption: id, p_admin: user?.id, p_reason: reason });
    if (error) toast.error(error.message); else { toast.success("Rejeitado"); await load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED", "ALL"].map(s => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>{s}</Button>
        ))}
      </div>
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Usuário</TableHead><TableHead>Pontos</TableHead><TableHead>Status</TableHead><TableHead>Criado</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.order_number}</TableCell>
                <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}</TableCell>
                <TableCell>{r.total_points}</TableCell>
                <TableCell><Badge>{r.status}</Badge></TableCell>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell>
                  {r.status === "PENDING" && (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => approve(r.id)}>Aprovar</Button>
                      <Button size="sm" variant="destructive" onClick={() => reject(r.id)}>Rejeitar</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum resgate</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ------------------------ Página ------------------------
export default function AdminPontosLoja() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !profile?.is_admin)) navigate("/dashboard");
  }, [authLoading, user, profile, navigate]);

  if (authLoading || !user || !profile?.is_admin) return <div className="p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Pontos & Loja Show</h1>
        <p className="text-muted-foreground text-sm">Administração completa do Programa Pontos Show.</p>
      </div>
      <Tabs defaultValue="config">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="config">Configurações</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="items">Itens</TabsTrigger>
          <TabsTrigger value="redemptions">Resgates</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4"><ConfigTab /></TabsContent>
        <TabsContent value="rules" className="mt-4"><RulesTab /></TabsContent>
        <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
        <TabsContent value="items" className="mt-4"><ItemsTab /></TabsContent>
        <TabsContent value="redemptions" className="mt-4"><RedemptionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
