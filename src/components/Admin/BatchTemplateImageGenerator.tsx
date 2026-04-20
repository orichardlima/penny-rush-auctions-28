import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductTemplate, TEMPLATE_CATEGORIES } from '@/hooks/useProductTemplates';

const MAX_BATCH = 50;
const DELAY_MS = 800;

type TierFilter = 'standard' | 'premium' | 'luxury' | 'all';

type ItemStatus = 'pending' | 'running' | 'success' | 'failed';

interface ItemResult {
  id: string;
  title: string;
  status: ItemStatus;
  source?: string;
  error?: string;
}

interface Props {
  templates: ProductTemplate[];
  onClose: () => void;
  onCompleted: () => void;
}

export const BatchTemplateImageGenerator = ({ templates, onClose, onCompleted }: Props) => {
  const [tier, setTier] = useState<TierFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ItemResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [abortNotice, setAbortNotice] = useState<string | null>(null);

  const candidates = useMemo(() => {
    return templates.filter((t) => {
      if (tier !== 'all' && t.tier !== tier) return false;
      if (category !== 'all' && t.category !== category) return false;
      if (onlyMissing && (t.image_url || t.image_key)) return false;
      return true;
    });
  }, [templates, tier, category, onlyMissing]);

  const totalToRun = Math.min(candidates.length, MAX_BATCH);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runBatch = async () => {
    if (totalToRun === 0) {
      toast.error('Nenhum template corresponde aos filtros');
      return;
    }
    setRunning(true);
    setProgress(0);
    setAbortNotice(null);
    const initial: ItemResult[] = candidates.slice(0, totalToRun).map((t) => ({
      id: t.id,
      title: t.title,
      status: 'pending',
    }));
    setResults(initial);

    let success = 0;
    let failed = 0;
    let aborted = false;

    for (let i = 0; i < initial.length; i++) {
      const item = initial[i];
      setResults((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: 'running' } : r)));

      try {
        const { data, error } = await supabase.functions.invoke('generate-template-image', {
          body: { template_id: item.id },
        });

        // Mensagem real do servidor (mesmo em respostas non-2xx, o body pode trazer error)
        const serverError = (data as any)?.error as string | undefined;
        const lower = (serverError || error?.message || '').toLowerCase();

        // Detecta billing (402) ou rate limit (429) e aborta o lote
        const isBilling =
          lower.includes('crédit') ||
          lower.includes('credit') ||
          lower.includes('payment_required') ||
          lower.includes('402');
        const isRateLimit =
          lower.includes('limite de requisi') ||
          lower.includes('rate limit') ||
          lower.includes('too many requests') ||
          lower.includes('429');

        if (isBilling || isRateLimit) {
          const notice = isBilling
            ? 'Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage e tente novamente.'
            : 'Limite de requisições atingido. Aguarde alguns minutos e reinicie o lote.';
          setAbortNotice(notice);
          toast.error(notice);
          // Item atual marcado como falha com mensagem clara; restantes ficam pending
          setResults((prev) =>
            prev.map((r) => (r.id === item.id ? { ...r, status: 'failed', error: notice } : r))
          );
          aborted = true;
          break;
        }

        if (serverError) {
          throw new Error(serverError);
        }
        if (error) throw error;

        if (data?.image_url) {
          success++;
          setResults((prev) =>
            prev.map((r) =>
              r.id === item.id ? { ...r, status: 'success', source: data?.source } : r
            )
          );
        } else {
          failed++;
          setResults((prev) =>
            prev.map((r) =>
              r.id === item.id ? { ...r, status: 'failed', error: 'Sem imagem retornada' } : r
            )
          );
        }
      } catch (err: any) {
        failed++;
        const msg = err?.message || 'Erro desconhecido';
        setResults((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, status: 'failed', error: msg } : r))
        );
      }

      setProgress(Math.round(((i + 1) / initial.length) * 100));
      if (i < initial.length - 1) await sleep(DELAY_MS);
    }

    setRunning(false);
    if (!aborted) {
      toast.success(`Lote finalizado: ${success} regerados, ${failed} falharam`);
    }
    onCompleted();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as TierFilter)} disabled={running}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Standard + Premium + Luxury</SelectItem>
                <SelectItem value="standard">Apenas Standard</SelectItem>
                <SelectItem value="premium">Apenas Premium</SelectItem>
                <SelectItem value="luxury">Apenas Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory} disabled={running}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="onlyMissing"
            checked={onlyMissing}
            onCheckedChange={(c) => setOnlyMissing(!!c)}
            disabled={running}
          />
          <Label htmlFor="onlyMissing" className="cursor-pointer text-sm">
            Apenas templates sem imagem
          </Label>
        </div>

        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="space-y-1">
            <p>
              <strong>{candidates.length}</strong> templates correspondem aos filtros
              {candidates.length > MAX_BATCH && (
                <> (apenas os primeiros {MAX_BATCH} serão processados)</>
              )}.
            </p>
            <p className="text-xs text-muted-foreground">
              Itens Luxury com Image Key definido continuam usando a imagem oficial; só serão sobrescritos se você apagar o Image Key. Cada imagem leva ~10–15s.
            </p>
            <p className="text-xs text-muted-foreground">
              Cada imagem consome ~1 crédito de IA (até ~2 com retry para itens com marca).
            </p>
          </div>
        </div>
      </div>

      {abortNotice && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <strong>Lote interrompido:</strong> {abortNotice}
        </div>
      )}

      {(running || results.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Progresso</span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
          <ScrollArea className="h-56 rounded border">
            <ul className="divide-y">
              {results.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {r.status === 'pending' && (
                    <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                  )}
                  {r.status === 'running' && (
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {r.status === 'success' && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  {r.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="flex-1 truncate">{r.title}</span>
                  {r.source && (
                    <span className="text-xs text-muted-foreground">{r.source}</span>
                  )}
                  {r.error && (
                    <span className="text-xs text-destructive truncate max-w-[200px]">
                      {r.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={running}>
          Fechar
        </Button>
        <Button onClick={runBatch} disabled={running || totalToRun === 0} className="gap-2">
          {running ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {running ? 'Gerando...' : `Iniciar Regeração (${totalToRun})`}
        </Button>
      </div>
    </div>
  );
};
