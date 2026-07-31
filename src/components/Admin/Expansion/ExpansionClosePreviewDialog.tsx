import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Eye, Info, Loader2, RefreshCw } from 'lucide-react';

const sb = supabase as any;

const brl = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const pts = (v: any) => new Intl.NumberFormat('pt-BR').format(Math.round(Number(v || 0)));
const dtHora = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString('pt-BR', {
        timeZone: 'America/Bahia',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : '—';

export default function ExpansionClosePreviewDialog({ defaultPeriodStart }: { defaultPeriodStart?: string }) {
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart || '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await sb.rpc('expansion_admin_preview_close', {
        _period_start: periodStart || null,
      });
      if (error) throw error;
      setData(res);
      toast.success('Prévia calculada. Nenhum dado foi gravado.');
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast.error(msg.includes('not authorized') ? 'Você não tem permissão administrativa.' : msg || 'Erro ao calcular a prévia');
    } finally {
      setLoading(false);
    }
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && !data) run();
  };

  const rows: any[] = data?.rows || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye className="h-4 w-4 mr-1" /> Prévia de fechamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prévia de fechamento semanal</DialogTitle>
          <DialogDescription>
            Simulação em modo somente leitura. Nada é gravado: nenhum snapshot, consumo, crédito ou notificação é gerado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="preview-period">Início do período (segunda-feira)</Label>
            <Input
              id="preview-period"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Deixe em branco para simular a semana em curso.</p>
          </div>
          <Button onClick={run} disabled={loading} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Calcular prévia
          </Button>
        </div>

        {data && (
          <div className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm space-y-1">
                <div>
                  <Badge variant={data.mode === 'official' ? 'default' : 'secondary'} className="mr-2">
                    {data.mode === 'official' ? 'Resultado oficial' : 'Estimativa'}
                  </Badge>
                  Período: <strong>{dtHora(data.period_start_at)}</strong> até <strong>{dtHora(data.period_end_at)}</strong> (America/Bahia) · Percentual: <strong>{Number(data.bonus_percent)}%</strong>
                </div>
                {data.mode === 'official' ? (
                  <div className="text-muted-foreground">
                    Semana já fechada ({data.already_closed_snapshots} snapshot(s)). Os valores exibidos vêm dos snapshots oficiais — nada é recalculado com os saldos atuais.
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    Semana em aberto: os valores são uma <strong>estimativa</strong> e só serão confirmados no fechamento semanal.
                  </div>
                )}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { l: 'Parceiros analisados', v: pts(data.partners_count) },
                { l: 'Com bônus', v: pts(data.partners_with_bonus) },
                { l: 'VQE zero', v: pts(data.partners_zero_vqe) },
                { l: 'Atingiram o teto', v: pts(data.partners_cap_reached) },
                { l: 'VQE total', v: `${pts(data.total_vqe)} pts` },
                { l: data.mode === 'official' ? 'Bônus total' : 'Bônus total estimado', v: brl(data.total_bonus) },
                { l: 'Carryforward', v: `${pts(data.total_carryforward)} pts` },
              ].map((c) => (
                <div key={c.l} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground mb-1 truncate">{c.l}</div>
                  <p className="font-bold text-sm break-words">{c.v}</p>
                </div>
              ))}
            </div>


            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum parceiro com pontos disponíveis neste período.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Parceiro</th>
                      <th className="p-2 font-medium">Plano</th>
                      <th className="p-2 font-medium text-right">Equipes</th>
                      <th className="p-2 font-medium text-right">Maior equipe</th>
                      <th className="p-2 font-medium text-right">Demais</th>
                      <th className="p-2 font-medium text-right">VQE</th>
                      <th className="p-2 font-medium text-right">VQE pagável</th>
                      <th className="p-2 font-medium text-right">Teto</th>
                      <th className="p-2 font-medium text-right">Bônus</th>
                      <th className="p-2 font-medium text-right">Carryforward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any) => (
                      <tr key={r.user_id} className="border-t">
                        <td className="p-2 max-w-[180px] truncate">{r.name}</td>
                        <td className="p-2">{r.plan_name || '—'}</td>
                        <td className="p-2 text-right">{pts(r.teams_count)}</td>
                        <td className="p-2 text-right">{pts(r.largest_team_points)}</td>
                        <td className="p-2 text-right">{pts(r.other_teams_points)}</td>
                        <td className="p-2 text-right">{pts(r.vqe_points)}</td>
                        <td className="p-2 text-right">{pts(r.payable_vqe_points)}</td>
                        <td className="p-2 text-right">
                          {brl(r.weekly_cap)}
                          {r.cap_applied && <Badge variant="secondary" className="ml-1">teto</Badge>}
                        </td>
                        <td className="p-2 text-right font-semibold">{brl(r.final_bonus)}</td>
                        <td className="p-2 text-right">{pts(r.carryforward_points)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
