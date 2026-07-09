import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  LineChart, Copy, MousePointerClick, UserPlus, ShoppingBag, Users,
  Trophy, ChevronDown, Info, ExternalLink,
} from 'lucide-react';
import { usePartnerPerformance } from '@/hooks/usePartnerPerformance';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const PUBLIC_HOST = 'showdelances.com';

function formatWeek(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const PartnerPerformanceSection: React.FC = () => {
  const { visible, loading, summary, history, error } = usePartnerPerformance();
  const [open, setOpen] = React.useState(true);

  if (!visible && !loading) return null;

  const link = summary?.referral_code
    ? `${PUBLIC_HOST}/r/${summary.referral_code}`
    : null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(`https://${link}`);
      toast({ title: 'Link copiado!', description: link });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const maxHistory = Math.max(1, ...history.map(h => h.total_points));

  return (
    <Card className="border-primary/30">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 flex-wrap">
                <LineChart className="h-5 w-5 text-primary" />
                Minha Performance
                <Badge variant="secondary" className="text-[10px]">Modo relatório</Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Dados reais da sua divulgação rastreada. <strong>Ainda não impacta seu repasse</strong> — o cálculo continua pelas confirmações diárias acima.
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0">
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
                </div>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Link rastreável */}
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground mb-1">Meu link rastreável</div>
                  {link ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm truncate bg-background rounded px-2 py-1 border">
                        {link}
                      </code>
                      <Button size="sm" variant="outline" onClick={copyLink}>
                        <Copy className="h-4 w-4 mr-1" /> Copiar
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Seu link ainda não foi gerado. Entre em contato com o suporte.
                    </div>
                  )}
                </div>

                {/* KPIs da semana */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Sua semana atual</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <KpiCard icon={MousePointerClick} label="Cliques" value={summary?.qualified_clicks ?? 0} color="text-blue-500" />
                    <KpiCard icon={UserPlus} label="Cadastros" value={summary?.signups ?? 0} color="text-green-500" />
                    <KpiCard icon={ShoppingBag} label="Compras" value={summary?.purchases_approved ?? 0} color="text-orange-500" />
                    <KpiCard icon={Users} label="Novos parceiros" value={summary?.contracts_approved ?? 0} color="text-purple-500" />
                  </div>
                </div>

                {/* Pontos e ranking */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Pontos da semana</div>
                    <div className="text-2xl font-bold">{(summary?.total_points ?? 0).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Cliques: {(summary?.click_points ?? 0).toFixed(1)} · Conversões: {(summary?.conversion_points ?? 0).toFixed(1)} · Dias ativos: {summary?.active_days ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Trophy className="h-3.5 w-3.5" /> Ranking da semana
                    </div>
                    {summary && summary.week_rank > 0 ? (
                      <div className="text-lg font-semibold mt-1">
                        {summary.week_rank}º <span className="text-sm text-muted-foreground font-normal">de {summary.week_total_partners} parceiros</span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground mt-1">Sem pontos ainda esta semana</div>
                    )}
                  </div>
                </div>

                {/* Histórico */}
                {history.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Últimas semanas</div>
                    <div className="flex items-end gap-2 h-24">
                      {[...history].reverse().map((h) => {
                        const heightPct = Math.max(4, Math.round((h.total_points / maxHistory) * 100));
                        return (
                          <div key={h.week_start} className="flex-1 flex flex-col items-center gap-1">
                            <div className="text-[10px] text-muted-foreground">{h.total_points.toFixed(0)}</div>
                            <div
                              className="w-full rounded-t bg-primary/70"
                              style={{ height: `${heightPct}%` }}
                              title={`Semana de ${h.week_start}: ${h.total_points} pts`}
                            />
                            <div className="text-[10px] text-muted-foreground">{formatWeek(h.week_start)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Aviso */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Esta seção é <strong>informativa</strong>. Seu repasse continua sendo calculado pelas confirmações diárias da Central de Anúncios.
                    <Link to="/guia-parceiro" className="inline-flex items-center gap-1 ml-1 text-primary hover:underline">
                      Entenda como funciona <ExternalLink className="h-3 w-3" />
                    </Link>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

const KpiCard: React.FC<{ icon: React.ElementType; label: string; value: number; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div className="rounded-lg border p-3 bg-background">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      {label}
    </div>
    <div className="text-xl font-bold mt-1">{value}</div>
  </div>
);

export default PartnerPerformanceSection;
