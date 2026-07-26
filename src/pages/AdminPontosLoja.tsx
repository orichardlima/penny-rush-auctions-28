import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type Row = { key: string; value: unknown; is_admin_only: boolean };

/**
 * /admin/pontos-loja — Fase 1 v3 (somente leitura)
 * Exibe flags, cutoff, proporção, prioridade, elegibilidade e o gate de
 * pré-requisitos para futura ativação. Nenhum controle destrutivo aqui.
 */
export default function AdminPontosLoja() {
  const [bools, setBools] = useState<Row[]>([]);
  const [nums, setNums] = useState<Row[]>([]);
  const [times, setTimes] = useState<Row[]>([]);
  const [jsonRows, setJsonRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sb = supabase as any;
        const [b, n, t, j] = await Promise.all([
          sb.from("points_program_settings_bool").select("key,value,is_admin_only"),
          sb.from("points_program_settings_num").select("key,value,is_admin_only"),
          sb.from("points_program_settings_time").select("key,value,is_admin_only"),
          sb.from("points_program_settings_json").select("key,value,is_admin_only"),
        ]);
        if (b.error || n.error || t.error || j.error) {
          setError(b.error?.message || n.error?.message || t.error?.message || j.error?.message || "erro");
        } else {
          setBools((b.data as Row[]) || []);
          setNums((n.data as Row[]) || []);
          setTimes((t.data as Row[]) || []);
          setJsonRows((j.data as Row[]) || []);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const boolByKey = (k: string) => bools.find((r) => r.key === k)?.value as boolean | undefined;
  const timeByKey = (k: string) => times.find((r) => r.key === k)?.value as string | null | undefined;

  const prereqs = [
    { label: "Data de acúmulo definida (points_accrual_started_at)", ok: !!timeByKey("points_accrual_started_at") },
    { label: "Consumo de lotes habilitado (points_lot_consumption_enabled)", ok: !!boolByKey("points_lot_consumption_enabled") },
    { label: "Webhooks validados (Fase 2)", ok: !!boolByKey("webhooks_validated") },
    { label: "Audiência piloto configurada", ok: !!boolByKey("audience_configured") },
  ];
  const canActivateAccrual = prereqs.every((p) => p.ok);

  if (loading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (error) return <div className="p-6"><Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Pontos & Loja Show</h1>
        <p className="text-muted-foreground text-sm">Fase 1 v3 — somente leitura. Nada ativado, nada emitido.</p>
      </div>

      <Alert>
        <AlertTitle>Modo somente leitura</AlertTitle>
        <AlertDescription>
          Esta fase entrega apenas a infraestrutura de configuração e rastreabilidade.
          Loja, carteira, resgates, produtos e pedidos entram nas fases seguintes.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle>Feature Flags</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bools.map((r) => (
            <div key={r.key} className="flex items-center justify-between border rounded p-3">
              <span className="text-sm font-mono">{r.key}</span>
              <Badge variant={r.value ? "default" : "secondary"}>{r.value ? "ON" : "OFF"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Parâmetros numéricos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {nums.map((r) => (
            <div key={r.key} className="flex items-center justify-between border rounded p-3">
              <span className="text-sm font-mono">{r.key}</span>
              <span className="font-semibold">{String(r.value)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Datas de corte</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {times.map((r) => (
            <div key={r.key} className="flex items-center justify-between border rounded p-3">
              <span className="text-sm font-mono">{r.key}</span>
              <span className="font-semibold">{r.value ? new Date(r.value as string).toLocaleString("pt-BR") : "— não definido —"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Configurações estruturais</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {jsonRows.map((r) => (
            <div key={r.key} className="border rounded p-3">
              <div className="text-sm font-mono mb-1">{r.key}</div>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(r.value, null, 2)}</pre>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pré-requisitos para ativar o acúmulo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {prereqs.map((p) => (
            <div key={p.label} className="flex items-center justify-between border rounded p-3">
              <span className="text-sm">{p.label}</span>
              <Badge variant={p.ok ? "default" : "destructive"}>{p.ok ? "OK" : "Falta"}</Badge>
            </div>
          ))}
          <div className="pt-3">
            <Badge variant={canActivateAccrual ? "default" : "secondary"}>
              {canActivateAccrual ? "Pronto para ativação (aguardando autorização)" : "Ativação bloqueada"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
