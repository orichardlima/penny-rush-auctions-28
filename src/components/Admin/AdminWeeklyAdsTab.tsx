import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  History,
} from 'lucide-react';
import {
  useAdminWeeklyAds,
  fetchContractHistory,
  WeeklyAdsStatus,
} from '@/hooks/useAdminWeeklyAds';
import { formatWeekRangeLabel } from '@/utils/weekHelpers';

const statusBadge = (status: WeeklyAdsStatus) => {
  switch (status) {
    case 'META':
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">META 7/7</Badge>;
    case 'PENALIDADE':
      return <Badge className="bg-amber-600 hover:bg-amber-600">PENALIDADE 40%</Badge>;
    case 'ZERADO':
      return <Badge variant="destructive">ZERADO 0%</Badge>;
    case 'EM_ANDAMENTO':
      return <Badge variant="secondary">EM ANDAMENTO</Badge>;
  }
};

const AdminWeeklyAdsTab: React.FC = () => {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = atual, -1 = anterior, etc
  const anchor = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const { rows, summary, loading, weekDays, isCurrentWeek, refresh } =
    useAdminWeeklyAds(anchor);

  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'with' | 'without'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | WeeklyAdsStatus>('all');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRow, setHistoryRow] = useState<{ name: string; id: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (scopeFilter === 'with' && r.completedCount < 1) return false;
      if (scopeFilter === 'without' && r.completedCount > 0) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (term) {
        const hay = `${r.user_name} ${r.user_email} ${r.user_phone || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, scopeFilter, statusFilter]);

  const openHistory = async (contractId: string, name: string) => {
    setHistoryRow({ id: contractId, name });
    setHistoryOpen(true);
    setHistoryLoading(true);
    const data = await fetchContractHistory(contractId, 4);
    setHistory(data);
    setHistoryLoading(false);
  };

  const exportCsv = () => {
    const header = ['Parceiro', 'Email', 'Telefone', 'Plano', 'Confirmações', 'Status', '% Payout', ...weekDays.map((d) => `${d.label} ${d.dayNumber}`)];
    const lines = [header.join(';')];
    filtered.forEach((r) => {
      const dayCells = weekDays.map((d) => (r.completedDates.includes(d.date) ? 'X' : ''));
      lines.push(
        [
          r.user_name,
          r.user_email,
          r.user_phone || '',
          r.plan_name,
          r.completedCount,
          r.status,
          r.payoutPercentage + '%',
          ...dayCells,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(';')
      );
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `divulgacao-semanal-${formatWeekRangeLabel(anchor).replace(/[\/\s–]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Controles de semana */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset(weekOffset - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <div className="text-sm font-medium px-2">
                {isCurrentWeek ? 'Semana atual · ' : ''}
                {formatWeekRangeLabel(anchor)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset(weekOffset + 1)}
                disabled={weekOffset >= 0}
              >
                Próxima <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                  Voltar para atual
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Cards-resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Parceiros ativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">≥ 1 confirmação</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.withAtLeastOne}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-emerald-600">Meta (100%)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{summary.meta}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-amber-600">Penalidade (40%)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{summary.penalty}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-destructive">Zerado (0%)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{summary.zero}</div></CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, email ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={scopeFilter} onValueChange={(v: any) => setScopeFilter(v)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os parceiros</SelectItem>
                <SelectItem value="with">Com ≥ 1 confirmação</SelectItem>
                <SelectItem value="without">Sem confirmações</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="META">Meta 7/7</SelectItem>
                <SelectItem value="PENALIDADE">Penalidade</SelectItem>
                <SelectItem value="ZERADO">Zerado</SelectItem>
                <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground ml-auto">
              {filtered.length} de {rows.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Plano</TableHead>
                  {weekDays.map((d) => (
                    <TableHead key={d.date} className="text-center w-10">
                      <div className={`text-xs ${d.isToday ? 'text-primary font-bold' : ''}`}>
                        {d.label}
                        <div className="text-[10px] text-muted-foreground">{d.dayNumber}</div>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhum parceiro encontrado.</TableCell></TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.contract_id}>
                      <TableCell>
                        <div className="font-medium">{r.user_name}</div>
                        <div className="text-xs text-muted-foreground">{r.user_email}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{r.plan_name}</Badge></TableCell>
                      {weekDays.map((d) => {
                        const done = r.completedDates.includes(d.date);
                        return (
                          <TableCell key={d.date} className="text-center">
                            {done ? (
                              <CheckCircle2 className={`h-5 w-5 mx-auto text-emerald-600 ${d.isToday ? 'ring-2 ring-primary rounded-full' : ''}`} />
                            ) : (
                              <span className={`text-muted-foreground ${d.isToday ? 'font-bold text-primary' : ''}`}>—</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-medium">{r.completedCount}/7</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openHistory(r.contract_id, r.user_name)}>
                          <History className="h-4 w-4 mr-1" /> Histórico
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Histórico Modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico — {historyRow?.name}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="text-center py-6 text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium">{formatWeekRangeLabel(h.weekStart)}</div>
                    <div className="text-xs text-muted-foreground">{h.count}/7 confirmações</div>
                  </div>
                  {statusBadge(h.status)}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWeeklyAdsTab;
