import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  Users, TrendingUp, Crown, Target, Gauge, Rocket, Info, CalendarClock,
  Sparkles, PiggyBank, ChevronDown, HelpCircle, CheckCircle2, Clock,
} from 'lucide-react';
import { useExpansionProgram, type ExpansionSnapshot } from '@/hooks/useExpansionProgram';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const pts = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(Number(v || 0)));
const dt = (v?: string | null) => (v ? new Date(v + (v.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR') : '—');

const STATUS_LABEL: Record<string, { label: string; variant: 'secondary' | 'default' | 'outline' }> = {
  draft: { label: 'Em processamento', variant: 'outline' },
  closed: { label: 'Fechamento concluído', variant: 'secondary' },
  released: { label: 'Crédito liberado', variant: 'default' },
};

function Metric({ icon: Icon, label, value, hint, accent }: {
  icon: any; label: string; value: string; hint?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? 'bg-primary/5 border-primary/30' : 'bg-card'}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight break-words">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function SnapshotDetails({ snap }: { snap: ExpansionSnapshot }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        <div><span className="text-muted-foreground block text-xs">Plano</span>{snap.plan_name || '—'}</div>
        <div><span className="text-muted-foreground block text-xs">Teto semanal</span>{brl(snap.weekly_cap)}</div>
        <div><span className="text-muted-foreground block text-xs">Percentual</span>{Number(snap.bonus_percent)}%</div>
        <div><span className="text-muted-foreground block text-xs">Maior equipe</span>{pts(snap.largest_team_points)} pts</div>
        <div><span className="text-muted-foreground block text-xs">Soma das demais</span>{pts(snap.other_teams_points)} pts</div>
        <div><span className="text-muted-foreground block text-xs">VQE disponível</span>{pts(snap.vqe_points)} pts</div>
        <div><span className="text-muted-foreground block text-xs">VQE pagável</span>{pts(snap.payable_vqe_points)} pts</div>
        <div><span className="text-muted-foreground block text-xs">Pontos consumidos</span>{pts(snap.total_points_consumed)} pts</div>
        <div><span className="text-muted-foreground block text-xs">Acumulado (carryforward)</span>{pts(snap.carryforward_points)} pts</div>
        <div><span className="text-muted-foreground block text-xs">Fechado em</span>{snap.closed_at ? new Date(snap.closed_at).toLocaleString('pt-BR') : '—'}</div>
        <div><span className="text-muted-foreground block text-xs">Liberado em</span>{snap.released_at ? new Date(snap.released_at).toLocaleString('pt-BR') : '—'}</div>
        <div><span className="text-muted-foreground block text-xs">Bônus</span><span className="font-semibold">{brl(snap.final_bonus)}</span></div>
      </div>

      {snap.consumptions?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Consumo por equipe</p>
          {snap.consumptions.map((c) => (
            <div key={c.team_root_user_id} className="rounded-md border p-2 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{c.team_name}</span>
                {c.role === 'LARGEST' && <Badge variant="secondary" className="text-[10px]">Maior equipe</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-1 text-muted-foreground">
                <span>Antes: <span className="text-foreground">{pts(c.points_available)}</span></span>
                <span>Consumido: <span className="text-foreground">{pts(c.points_consumed)}</span></span>
                <span>Depois: <span className="text-foreground">{pts(c.balance_after)}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExpansionProgramSection() {
  const { overview, teams, snapshots, loading } = useExpansionProgram();
  const [showHow, setShowHow] = useState(false);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!overview || !overview.program) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Programa de Expansão por Equipes</AlertTitle>
        <AlertDescription>Não foi possível carregar os dados do programa no momento.</AlertDescription>
      </Alert>
    );
  }

  const preLaunch = !overview.program.official_start_at || !overview.program.weekly_close_enabled;
  const hasTeams = teams.length > 0;

  return (
    <div className="space-y-5">
      {/* Estado pré-lançamento */}
      {preLaunch && (
        <Alert className="border-primary/40 bg-primary/5">
          <Rocket className="h-4 w-4 text-primary" />
          <AlertTitle>Programa de Expansão em preparação</AlertTitle>
          <AlertDescription className="text-sm">
            O novo <strong>Programa de Expansão por Equipes</strong> será ativado em breve. Os pontos da sua
            organização já estão sendo registrados e permanecem acumulados. Os fechamentos semanais e o crédito
            do bônus começam apenas após a data oficial de início.
          </AlertDescription>
        </Alert>
      )}

      {/* Resumo do período */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Programa de Expansão por Equipes
              </CardTitle>
              <CardDescription>
                Período atual: {dt(overview.period_start)} a {dt(overview.period_end)}
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <CalendarClock className="h-3 w-3" />
              Próximo fechamento: {dt(overview.next_close_date)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Metric icon={Users} label="Equipes" value={pts(overview.teams_count)} />
            <Metric icon={PiggyBank} label="Pontos disponíveis" value={`${pts(overview.total_points_available)} pts`} />
            <Metric icon={TrendingUp} label="Gerados no período" value={`${pts(overview.week_points)} pts`} />
            <Metric icon={Crown} label="Maior equipe" value={`${pts(overview.largest_team_points)} pts`} />
            <Metric icon={Users} label="Soma das demais" value={`${pts(overview.other_teams_points)} pts`} />
            <Metric icon={Target} label="VQE disponível" value={`${pts(overview.vqe_available)} pts`} accent
              hint="Equilíbrio entre a maior equipe e as demais" />
            <Metric icon={Gauge} label="VQE pagável nesta semana" value={`${pts(overview.vqe_payable)} pts`} accent
              hint="Parte do VQE dentro do teto do plano" />
            <Metric icon={Sparkles} label="Percentual do bônus" value={`${Number(overview.bonus_percent)}%`} />
            <Metric icon={Gauge} label="Teto semanal do plano" value={brl(overview.weekly_cap)}
              hint={overview.plan_name ? `Plano ${overview.plan_name}` : 'Sem contrato ativo'} />
            <Metric icon={PiggyBank} label="Permanece acumulado" value={`${pts(overview.carryforward_points)} pts`}
              hint="Não expira" />
          </div>
        </CardContent>
      </Card>

      {/* Card de estimativa */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Bônus de Expansão estimado nesta semana
          </CardTitle>
          <CardDescription>
            Valor estimado com base nos saldos atuais. O valor oficial é registrado no fechamento da semana.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-3xl font-bold text-primary">{brl(overview.estimated_bonus)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div><span className="text-xs text-muted-foreground block">VQE disponível</span>{pts(overview.vqe_available)} pts</div>
            <div><span className="text-xs text-muted-foreground block">VQE pagável</span>{pts(overview.vqe_payable)} pts</div>
            <div><span className="text-xs text-muted-foreground block">Percentual</span>{Number(overview.bonus_percent)}%</div>
            <div><span className="text-xs text-muted-foreground block">Teto do plano</span>{brl(overview.weekly_cap)}</div>
            <div><span className="text-xs text-muted-foreground block">Permanecerá acumulado</span>{pts(overview.carryforward_points)} pts</div>
            <div><span className="text-xs text-muted-foreground block">Plano considerado</span>{overview.plan_name || '—'}</div>
          </div>
          <Alert className="bg-background">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Estimativa em andamento — não representa saldo disponível. Os pontos que não forem utilizados nesta
              semana <strong>não são perdidos</strong>: permanecem acumulados para períodos futuros. O valor só entra
              na carteira após o fechamento e a liberação financeira.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Equipes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Minhas equipes</CardTitle>
          <CardDescription>Cada indicação direta inicia uma equipe independente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!hasTeams && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Você ainda não possui equipes. Ao indicar um novo parceiro, uma equipe é iniciada automaticamente.
            </div>
          )}
          {teams.map((t) => (
            <div key={t.team_root_user_id} className="rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={t.avatar_url || undefined} alt={t.name} />
                  <AvatarFallback>{(t.name || 'P').slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{t.name}</span>
                    {t.is_largest && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Crown className="h-3 w-3" /> Maior equipe
                      </Badge>
                    )}
                    {t.plan_name && <Badge variant="outline" className="text-[10px]">{t.plan_name}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.members_count} integrante(s)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-2 text-xs">
                    <span className="text-muted-foreground">Semana: <span className="text-foreground font-medium">{pts(t.week_points)}</span></span>
                    <span className="text-muted-foreground">Histórico: <span className="text-foreground font-medium">{pts(t.points_earned)}</span></span>
                    <span className="text-muted-foreground">Consumidos: <span className="text-foreground font-medium">{pts(t.points_consumed)}</span></span>
                    <span className="text-muted-foreground">Disponível: <span className="text-foreground font-medium">{pts(t.points_available)}</span></span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={Number(t.share_pct)} className="h-1.5" />
                    <span className="text-[11px] text-muted-foreground shrink-0">{Number(t.share_pct)}% do volume</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Como é calculado */}
      <Card>
        <Collapsible open={showHow} onOpenChange={setShowHow}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Como o Bônus de Expansão é calculado
                </CardTitle>
                <Button variant="ghost" size="sm">
                  <ChevronDown className={`h-4 w-4 transition-transform ${showHow ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>Cada indicação direta inicia uma equipe.</li>
                <li>Os pontos gerados pela sua organização ficam vinculados à respectiva equipe.</li>
                <li>O sistema compara a maior equipe com a soma das demais.</li>
                <li>O menor desses dois volumes forma o <strong className="text-foreground">VQE</strong>.</li>
                <li>Aplica-se o percentual de {Number(overview.bonus_percent)}%.</li>
                <li>Respeita-se o teto semanal do seu plano.</li>
                <li>Os pontos não utilizados permanecem acumulados para as próximas semanas.</li>
              </ol>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium text-foreground mb-1">Exemplo</p>
                <p>Equipe João: 4.000</p>
                <p>Equipe Maria: 3.000</p>
                <p>Equipe Carlos: 2.000</p>
                <p>Equipe Fernanda: 1.000</p>
                <p className="pt-1">Maior equipe: 4.000 · Soma das demais: 6.000</p>
                <p>VQE: 4.000 · Bônus a 20%: <strong className="text-foreground">R$ 800,00</strong></p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Histórico de fechamentos */}
      <Card id="expansao-historico" className="scroll-mt-24">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de fechamentos</CardTitle>
          <CardDescription>Valores oficiais registrados a cada semana encerrada.</CardDescription>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Ainda não há fechamentos registrados.
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {snapshots.map((s) => {
                const st = STATUS_LABEL[s.status_official] || { label: s.status_official, variant: 'outline' as const };
                return (
                  <AccordionItem key={s.id} value={s.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-left w-full pr-2">
                        <span className="text-sm font-medium">{dt(s.period_start)} — {dt(s.period_end)}</span>
                        <span className="text-sm font-semibold text-primary">{brl(s.final_bonus)}</span>
                        <Badge variant={st.variant} className="w-fit text-[10px]">{st.label}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {s.status_official === 'closed' && (
                        <Alert className="mb-3">
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Bônus calculado — aguardando liberação. Ainda não disponível na carteira.
                          </AlertDescription>
                        </Alert>
                      )}
                      <SnapshotDetails snap={s} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
