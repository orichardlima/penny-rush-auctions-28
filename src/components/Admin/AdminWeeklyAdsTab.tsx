import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CheckCircle2, Minus, Download, RefreshCw, Search, History, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useAdminWeeklyAds, useAdminPartnerAdHistory,
  REQUIRED_DAYS, PartnerWeekRow,
} from '@/hooks/useAdminWeeklyAds';
import { WEEK_DAY_LABELS } from '@/utils/weekHelpers';

const PAGE_SIZE = 50;

const statusBadge = (s: PartnerWeekRow['status']) => {
  switch (s) {
    case 'META':
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Meta cumprida (100%)</Badge>;
    case 'PENALIDADE':
      return <Badge className="bg-amber-500 hover:bg-amber-500">Penalidade (40%)</Badge>;
    case 'ZERADO':
      return <Badge variant="secondary">Zerado</Badge>;
    case 'EM_ANDAMENTO':
      return <Badge className="bg-blue-600 hover:bg-blue-600">Em andamento</Badge>;
  }
};

const formatBR = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const DayCell: React.FC<{ d: PartnerWeekRow['days'][number] }> = ({ d }) => {
  if (d.completed) {
    return (
      <div className={`w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto ${d.isToday ? 'ring-2 ring-blue-500' : ''}`}>
        <CheckCircle2 className="w-4 h-4" />
      </div>
    );
  }
  if (d.isFuture) {
    return <div className={`w-7 h-7 rounded-full bg-muted/30 mx-auto ${d.isToday ? 'ring-2 ring-blue-500' : ''}`} />;
  }
  return (
    <div className={`w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto ${d.isToday ? 'ring-2 ring-blue-500' : ''}`}>
      <Minus className="w-4 h-4" />
    </div>
  );
};

const AdminWeeklyAdsTab: React.FC = () => {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = atual, -1 = anterior
  const referenceDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const { loading, rows, weekStart, weekEnd, isCurrentWeek, refresh } = useAdminWeeklyAds(referenceDate);

  const [scope, setScope] = useState<'ALL' | 'WITH_CONFIRM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PartnerWeekRow['status']>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [historyContract, setHistoryContract] = useState<PartnerWeekRow | null>(null);

  const filtered = useMemo(() => {
    let r = rows;
    if (scope === 'WITH_CONFIRM') r = r.filter((x) => x.completedCount > 0);
    if (statusFilter !== 'ALL') r = r.filter((x) => x.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (x) =>
          x.fullName.toLowerCase().includes(q) ||
          x.email.toLowerCase().includes(q) ||
          (x.phone || '').toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, scope, statusFilter, search]);

  const totals = useMemo(() => {
    const total = rows.length;
    const withAny = rows.filter((r) => r.completedCount > 0).length;
    const meta = rows.filter((r) => r.status === 'META').length;
    const penal = rows.filter((r) => r.status === 'PENALIDADE').length;
    const zero = rows.filter((r) => r.status === 'ZERADO').length;
    const andamento = rows.filter((r) => r.status === 'EM_ANDAMENTO').length;
    return { total, withAny, meta, penal, zero, andamento };
  }, [rows]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const exportCSV = () => {
    const header = ['Nome', 'Email', 'Telefone', 'Plano', 'Cotas', ...WEEK_DAY_LABELS.map((_, i) => `D${i + 1}`), 'Total', 'Status'];
    const lines = filtered.map((r) => [
      `"${r.fullName.replace(/"/g, '""')}"`,
      r.email,
      r.phone || '',
      r.planName,
      r.cotas,
      ...r.days.map((d) => (d.completed ? '1' : '0')),
      r.completedCount,
      r.status,
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `divulgacao-semanal_${weekStart.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setWeekOffset((w) => w - 1); setPage(0); }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-medium px-2">
            Semana {formatBR(weekStart.toISOString().slice(0, 10))} – {formatBR(weekEnd.toISOString().slice(0, 10))}
            {isCurrentWeek && <span className="ml-2 text-xs text-blue-600">(atual)</span>}
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => { setWeekOffset((w) => Math.min(0, w + 1)); setPage(0); }}
            disabled={weekOffset >= 0}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setWeekOffset(0); setPage(0); }}>
              Voltar para atual
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Parceiros ativos</div><div className="text-2xl font-semibold">{totals.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Com ≥1 confirmação</div><div className="text-2xl font-semibold">{totals.withAny}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Meta 7/7 (100%)</div><div className="text-2xl font-semibold text-emerald-600">{totals.meta}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Penalidade (40%)</div><div className="text-2xl font-semibold text-amber-600">{totals.penal}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Zerados</div><div className="text-2xl font-semibold text-muted-foreground">{totals.zero}</div></CardContent></Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou telefone…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-8"
              />
            </div>
          </div>
          <div className="min-w-[180px]">
            <Select value={scope} onValueChange={(v: any) => { setScope(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os ativos</SelectItem>
                <SelectItem value="WITH_CONFIRM">Apenas com ≥1 confirmação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="META">Meta cumprida</SelectItem>
                <SelectItem value="PENALIDADE">Penalidade</SelectItem>
                <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                <SelectItem value="ZERADO">Zerados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Parceiros ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhum parceiro encontrado com os filtros atuais.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Plano</TableHead>
                    {WEEK_DAY_LABELS.map((l, i) => (
                      <TableHead key={i} className="text-center w-10">{l}</TableHead>
                    ))}
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => (
                    <TableRow key={r.contractId}>
                      <TableCell>
                        <div className="font-medium">{r.fullName}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.planName}</div>
                        <div className="text-xs text-muted-foreground">{r.cotas} cota{r.cotas > 1 ? 's' : ''}</div>
                      </TableCell>
                      {r.days.map((d, i) => (
                        <TableCell key={i} className="text-center"><DayCell d={d} /></TableCell>
                      ))}
                      <TableCell className="text-center font-medium">
                        {r.completedCount}/{REQUIRED_DAYS}
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setHistoryContract(r)}>
                          <History className="w-4 h-4 mr-1" /> Histórico
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {page + 1} de {pageCount}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
            Próxima
          </Button>
        </div>
      )}

      {/* Modal de histórico */}
      <Dialog open={!!historyContract} onOpenChange={(o) => !o && setHistoryContract(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Histórico — {historyContract?.fullName}
            </DialogTitle>
          </DialogHeader>
          {historyContract && <HistoryContent contractId={historyContract.contractId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const HistoryContent: React.FC<{ contractId: string }> = ({ contractId }) => {
  const { loading, history } = useAdminPartnerAdHistory(contractId, 4);
  if (loading) return <div className="text-sm text-muted-foreground py-4">Carregando…</div>;
  if (!history.length) return <div className="text-sm text-muted-foreground py-4">Sem dados.</div>;
  return (
    <div className="space-y-3">
      {history.map((w) => (
        <Card key={w.weekStart}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">
                {formatBR(w.weekStart)} – {formatBR(w.weekEnd)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{w.completedCount}/{REQUIRED_DAYS}</span>
                {statusBadge(w.status)}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {w.days.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="text-[10px] text-muted-foreground">{WEEK_DAY_LABELS[i]}</div>
                  <DayCell d={d} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminWeeklyAdsTab;
