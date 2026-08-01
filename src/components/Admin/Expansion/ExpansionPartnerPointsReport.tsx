import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';

const sb = supabase as any;

const brl = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const pts = (v: any) => new Intl.NumberFormat('pt-BR').format(Math.round(Number(v || 0)));
const dt = (v?: string | null) => (v ? new Date(v.length === 10 ? v + 'T12:00:00' : v).toLocaleDateString('pt-BR') : '—');

export default function ExpansionPartnerPointsReport() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await sb.rpc('expansion_admin_partner_points', {
        _search: query || null,
        _limit: 300,
      });
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      toast.error(e?.message?.includes('not authorized')
        ? 'Você não tem permissão administrativa para esta área.'
        : 'Erro ao carregar o consolidado de parceiros.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const totals = rows.reduce((acc, r) => ({
    gross: acc.gross + Number(r.points_gross || 0),
    available: acc.available + Number(r.points_available || 0),
    calculated: acc.calculated + Number(r.bonus_calculated || 0),
    released: acc.released + Number(r.bonus_released_wallet || 0),
  }), { gross: 0, available: 0, calculated: 0, released: 0 });

  return (
    <div className="space-y-3">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Somente leitura. Saldos vêm das fontes oficiais do programa; bônus calculado considera fechamentos
          concluídos e liberados, e o valor liberado considera apenas o crédito efetivo na carteira de rede.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Buscar parceiro"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setQuery(search); }}
          className="max-w-xs"
        />
        <Button size="sm" variant="outline" onClick={() => setQuery(search)}>Buscar</Button>
        {query && <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setQuery(''); }}>Limpar</Button>}
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { l: 'Pontos brutos', v: `${pts(totals.gross)} pts` },
          { l: 'Saldo disponível', v: `${pts(totals.available)} pts` },
          { l: 'Bônus calculado', v: brl(totals.calculated) },
          { l: 'Bônus liberado', v: brl(totals.released) },
        ].map((c) => (
          <div key={c.l} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">{c.l}</p>
            <p className="font-bold text-sm break-words">{c.v}</p>
          </div>
        ))}
      </div>

      {loading && <Skeleton className="h-40 w-full" />}
      {!loading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum parceiro encontrado.</p>
      )}

      <Accordion type="single" collapsible>
        {rows.map((r: any) => {
          const diff = Number(r.bonus_calculated || 0) - Number(r.bonus_released_wallet || 0);
          return (
            <AccordionItem key={r.user_id} value={r.user_id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-left w-full pr-2 text-sm">
                  <span className="font-medium">{r.partner_name || '—'}</span>
                  <span className="text-muted-foreground text-xs">{pts(r.points_available)} pts disponíveis · {r.teams_count} equipe(s)</span>
                  <span className="font-semibold text-primary">{brl(r.bonus_calculated)}</span>
                  {Math.abs(diff) > 0.009 && (
                    <Badge variant="outline" className="w-fit text-[10px]">A liberar {brl(diff)}</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>Pontos brutos: <strong>{pts(r.points_gross)}</strong></div>
                  <div>Revertidos: <strong>{pts(r.points_reversed)}</strong></div>
                  <div>Consumidos: <strong>{pts(r.points_consumed)}</strong></div>
                  <div>Disponível: <strong>{pts(r.points_available)}</strong></div>
                  <div>Maior equipe: <strong>{pts(r.largest_team_points)}</strong></div>
                  <div>Demais equipes: <strong>{pts(r.other_teams_points)}</strong></div>
                  <div>VQE estimado: <strong>{pts(r.vqe_estimate)}</strong></div>
                  <div>Bônus calculado: <strong>{brl(r.bonus_calculated)}</strong></div>
                  <div>Bônus liberado: <strong>{brl(r.bonus_released_wallet)}</strong></div>
                  <div>Pagamentos de expansão: <strong>{brl(r.expansion_payout_total)}</strong></div>
                  <div>Créditos na carteira: <strong>{brl(r.wallet_credit_total)}</strong></div>
                  <div>Fechamentos: <strong>{r.snapshots_count ?? 0}</strong></div>
                  <div>Último período: <strong>{dt(r.last_period_start)}</strong></div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
