import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, RefreshCw, ShieldAlert, Eye, LayoutDashboard, LineChart } from 'lucide-react';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  useAdminPerformance, bahiaTodayISO, toBahiaMondayISO, shiftBahiaWeek, formatWeekRange,
} from '@/hooks/useAdminPerformance';

const fmtPct = (v: number) => `${(v ?? 0).toFixed(1)}%`;
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Bahia' }) : '—';

const AdminCentralPerformance: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !profile?.is_admin)) navigate('/dashboard');
  }, [authLoading, user, profile, navigate]);

  const initialWeek = useMemo(() => toBahiaMondayISO(bahiaTodayISO()), []);
  const [weekStart, setWeekStart] = useState<string>(initialWeek);
  const {
    ranking, eligibility, kpis, fraud, audit, backfill, inconsistencies,
    centerEnabled, trackingEnabled, loading, error, refetch,
  } = useAdminPerformance(weekStart);

  if (authLoading || !user || !profile?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex flex-col">
      <SEOHead title="Central de Performance — Admin" description="Painel administrativo em modo relatório." />
      <Header />

      <div className="container mx-auto px-4 py-6 flex-1 space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dashboard" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator><ChevronRight className="w-4 h-4" /></BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                <LineChart className="w-4 h-4" /> Central de Performance
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header + status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LineChart className="w-6 h-6" /> Central de Performance
            </h1>
            <p className="text-sm text-muted-foreground">
              Visualização administrativa. Nenhuma ação altera pagamentos ou contratos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
              <Eye className="w-3 h-3 mr-1" /> MODO RELATÓRIO — sem impacto financeiro
            </Badge>
            <Badge variant={trackingEnabled ? 'default' : 'secondary'}>
              tracking: {trackingEnabled ? 'ON' : 'OFF'}
            </Badge>
            <Badge variant={centerEnabled ? 'destructive' : 'secondary'}>
              center: {centerEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Week selector */}
        <Card>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setWeekStart(shiftBahiaWeek(weekStart, -1))}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Semana anterior
              </Button>
              <div className="text-sm font-medium px-3">
                Semana Bahia: <span className="font-mono">{formatWeekRange(weekStart)}</span>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={() => setWeekStart(shiftBahiaWeek(weekStart, +1))}
                disabled={weekStart >= initialWeek}
              >
                Semana seguinte <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              {weekStart !== initialWeek && (
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(initialWeek)}>
                  Voltar para semana atual
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-4 text-sm text-destructive">Erro: {error}</CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Cliques qualificados" value={kpis?.qualified_clicks ?? 0} />
          <KpiCard label="Cliques suspeitos" value={kpis?.suspicious_clicks ?? 0} muted />
          <KpiCard label="Cadastros" value={kpis?.signups ?? 0} />
          <KpiCard label="Compras aprovadas" value={kpis?.purchases_approved ?? 0} />
          <KpiCard label="Contratos aprovados" value={kpis?.contracts_approved ?? 0} />
          <KpiCard label="Reversões" value={kpis?.reversed ?? 0} muted />
        </div>

        <Tabs defaultValue="ranking">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="eligibility">Elegibilidade simulada</TabsTrigger>
            <TabsTrigger value="antifraud">Antifraude</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
            <TabsTrigger value="inconsistencies">Inconsistências</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ranking de parceiros — pontos da semana</CardTitle>
                <CardDescription>Ordem por total de pontos. Dados apenas para relatório.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Parceiro</TableHead>
                      <TableHead className="text-right">Pontos totais</TableHead>
                      <TableHead className="text-right">Cliques</TableHead>
                      <TableHead className="text-right">Conversões</TableHead>
                      <TableHead className="text-right">Dias ativos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhum dado nesta semana.</TableCell></TableRow>
                    )}
                    {ranking.map((r, i) => (
                      <TableRow key={r.partner_user_id}>
                        <TableCell className="font-mono">{i + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.full_name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{r.email ?? r.partner_user_id.slice(0, 8)}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">{Number(r.total_points).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{Number(r.click_points).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{Number(r.conversion_points).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{r.active_days}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="eligibility">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Elegibilidade simulada</CardTitle>
                <CardDescription>Quem passaria caso a Central estivesse ativada. Não gera repasse.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parceiro</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Percentual</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibility.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Sem elegibilidade calculada.</TableCell></TableRow>
                    )}
                    {eligibility.map((e: any) => (
                      <TableRow key={e.partner_user_id}>
                        <TableCell className="text-xs font-mono">{e.full_name ?? e.partner_user_id.slice(0, 8)}</TableCell>
                        <TableCell><Badge variant={e.status === 'eligible' ? 'default' : 'secondary'}>{e.status}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{fmtPct(Number(e.percentage))}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.reason ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="antifraud">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Anti-fraude</CardTitle>
                <CardDescription>Últimas 50 flags detectadas. Nenhuma ação automática.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Parceiro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fraud.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Sem flags.</TableCell></TableRow>}
                    {fraud.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-xs">{fmtDate(f.created_at)}</TableCell>
                        <TableCell><Badge variant="outline">{f.flag_type}</Badge></TableCell>
                        <TableCell>{f.severity}</TableCell>
                        <TableCell>{f.status}</TableCell>
                        <TableCell className="text-xs font-mono">{f.partner_user_id?.slice(0, 8) ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Logs de auditoria</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Sem logs.</TableCell></TableRow>}
                      {audit.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{fmtDate(a.created_at)}</TableCell>
                          <TableCell className="text-xs font-mono">{a.action}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[280px] truncate">{a.error_message ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Backfill pendências</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Código</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backfill.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Sem pendências.</TableCell></TableRow>}
                      {backfill.map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell className="text-xs">{fmtDate(b.created_at)}</TableCell>
                          <TableCell className="text-xs font-mono">{b.issue_type}</TableCell>
                          <TableCell className="text-xs font-mono">{b.referral_code ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inconsistencies">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inconsistências detectadas</CardTitle>
                <CardDescription>Diagnóstico da semana selecionada.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inconsistencies.map((inc, i) => (
                    <div key={i} className="border rounded p-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{inc.kind}</div>
                        <div className="text-xs text-muted-foreground">{inc.detail}</div>
                      </div>
                      <Badge variant={inc.count > 0 ? 'destructive' : 'outline'}>{inc.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: number; muted?: boolean }> = ({ label, value, muted }) => (
  <Card className={muted ? 'opacity-70' : ''}>
    <CardContent className="py-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold font-mono">{value.toLocaleString('pt-BR')}</div>
    </CardContent>
  </Card>
);

export default AdminCentralPerformance;
