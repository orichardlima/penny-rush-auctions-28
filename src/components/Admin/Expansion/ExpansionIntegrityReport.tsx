import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const sb = supabase as any;

const dt = (v?: string | null) => (v ? new Date(v.length === 10 ? v + 'T12:00:00' : v).toLocaleDateString('pt-BR') : null);

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MEDIUM: 'Médio',
  LOW: 'Baixo',
  INFO: 'Informativo',
};

const severityVariant = (s: string): 'destructive' | 'default' | 'secondary' | 'outline' =>
  s === 'CRITICAL' || s === 'HIGH' ? 'destructive' : s === 'MEDIUM' ? 'default' : 'secondary';

export default function ExpansionIntegrityReport() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await sb.rpc('expansion_admin_integrity_check', { _limit: 500 });
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      toast.error(e?.message?.includes('not authorized')
        ? 'Você não tem permissão administrativa para esta área.'
        : 'Erro ao executar as verificações de integridade.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = SEVERITY_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = rows.filter((r) => r.severity === s).length;
    return acc;
  }, {});

  const visible = (filter === 'ALL' ? rows : rows.filter((r) => r.severity === filter))
    .slice()
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  const hasProblems = rows.some((r) => r.severity !== 'INFO');

  return (
    <div className="space-y-3">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Verificação somente leitura: não altera pontos, carteiras, fechamentos ou pagamentos. Executa sobre as
          fontes oficiais do Programa de Expansão.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Reexecutar verificações
        </Button>
        <Button size="sm" variant={filter === 'ALL' ? 'default' : 'ghost'} onClick={() => setFilter('ALL')}>
          Todos ({rows.length})
        </Button>
        {SEVERITY_ORDER.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? 'default' : 'ghost'}
            onClick={() => setFilter(s)}
            disabled={!counts[s]}
          >
            {SEVERITY_LABEL[s]} ({counts[s] || 0})
          </Button>
        ))}
      </div>

      {loading && <Skeleton className="h-40 w-full" />}

      {!loading && !hasProblems && (
        <Alert className="border-emerald-500/40">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Nenhuma inconsistência encontrada. Todos os registros estão consistentes com as regras do programa.
          </AlertDescription>
        </Alert>
      )}

      {!loading && visible.length === 0 && hasProblems && (
        <p className="text-sm text-muted-foreground">Nenhum registro nesta severidade.</p>
      )}

      {visible.map((r: any, i: number) => (
        <div key={`${r.code}-${r.user_id || 'g'}-${r.reference || i}`} className="rounded border p-3 text-xs space-y-1">
          <div className="flex justify-between gap-2 flex-wrap">
            <span className="font-medium text-sm">{r.title}</span>
            <Badge variant={severityVariant(r.severity)} className="text-[10px]">{SEVERITY_LABEL[r.severity] || r.severity}</Badge>
          </div>
          <p className="text-muted-foreground">{r.detail}</p>
          <div className="text-muted-foreground">
            {r.partner_name ? <>Parceiro: <strong>{r.partner_name}</strong> · </> : null}
            {dt(r.period_start) ? <>Período: <strong>{dt(r.period_start)}</strong> · </> : null}
            Código: <strong>{r.code}</strong>
            {r.reference ? <> · Referência: {r.reference}</> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
