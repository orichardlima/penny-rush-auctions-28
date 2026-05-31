import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Loader2, UserMinus, Clock, CheckCircle2, XCircle, RotateCcw, Eye, RefreshCw } from 'lucide-react';

interface ExitRow {
  id: string;
  partner_contract_id: string;
  partner_user_id: string;
  old_sponsor_user_id: string | null;
  old_sponsor_contract_id: string | null;
  old_binary_parent_contract_id: string | null;
  old_binary_position: string | null;
  new_sponsor_user_id: string | null;
  new_sponsor_contract_id: string | null;
  status: string;
  cancelled_pending_count: number;
  cancelled_pending_total: number;
  reversed_available_count: number;
  reversed_available_total: number;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  reminders_sent: any;
  partner_name?: string;
  partner_email?: string;
  old_sponsor_name?: string;
  new_sponsor_name?: string;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    PENDING_NEW_SPONSOR: { label: 'Aguardando novo patrocinador', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: <Clock className="h-3 w-3 mr-1" /> },
    COMPLETED: { label: 'Concluída', cls: 'bg-green-500/10 text-green-600 border-green-500/20', icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
    EXPIRED: { label: 'Expirada (Empresa)', cls: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: <XCircle className="h-3 w-3 mr-1" /> },
    REVERTED: { label: 'Revertida', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: <RotateCcw className="h-3 w-3 mr-1" /> },
  };
  const cfg = map[status] || { label: status, cls: '', icon: null };
  return <Badge className={cfg.cls} variant="outline">{cfg.icon}{cfg.label}</Badge>;
};

const AdminNetworkExitsTab: React.FC = () => {
  const [rows, setRows] = useState<ExitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<ExitRow | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partner_network_exits' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = (data || []) as unknown as ExitRow[];

      const userIds = Array.from(new Set(
        list.flatMap(r => [r.partner_user_id, r.old_sponsor_user_id, r.new_sponsor_user_id].filter(Boolean) as string[])
      ));

      let nameMap = new Map<string, { full_name: string; email?: string }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.rpc('get_public_profiles', { user_ids: userIds });
        nameMap = new Map((profiles || []).map((p: any) => [p.user_id, { full_name: p.full_name, email: p.email }]));
      }

      setRows(list.map(r => ({
        ...r,
        partner_name: nameMap.get(r.partner_user_id)?.full_name || 'N/A',
        partner_email: nameMap.get(r.partner_user_id)?.email,
        old_sponsor_name: r.old_sponsor_user_id ? (nameMap.get(r.old_sponsor_user_id)?.full_name || 'N/A') : 'Empresa',
        new_sponsor_name: r.new_sponsor_user_id ? (nameMap.get(r.new_sponsor_user_id)?.full_name || 'N/A') : null,
      })));
    } catch (err) {
      console.error('Erro ao buscar saídas de rede:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !r.partner_name?.toLowerCase().includes(s) &&
          !r.old_sponsor_name?.toLowerCase().includes(s) &&
          !r.new_sponsor_name?.toLowerCase().includes(s) &&
          !r.partner_email?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [rows, statusFilter, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(r => r.status === 'PENDING_NEW_SPONSOR').length,
    completed: rows.filter(r => r.status === 'COMPLETED').length,
    expired: rows.filter(r => r.status === 'EXPIRED').length,
    reverted: rows.filter(r => r.status === 'REVERTED').length,
  }), [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: <UserMinus className="h-4 w-4" /> },
          { label: 'Aguardando', value: stats.pending, icon: <Clock className="h-4 w-4 text-yellow-500" /> },
          { label: 'Concluídas', value: stats.completed, icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
          { label: 'Expiradas', value: stats.expired, icon: <XCircle className="h-4 w-4 text-orange-500" /> },
          { label: 'Revertidas', value: stats.reverted, icon: <RotateCcw className="h-4 w-4 text-blue-500" /> },
        ].map(c => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                {c.icon} {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="PENDING_NEW_SPONSOR">Aguardando novo patrocinador</SelectItem>
            <SelectItem value="COMPLETED">Concluídas</SelectItem>
            <SelectItem value="EXPIRED">Expiradas (vão p/ Empresa)</SelectItem>
            <SelectItem value="REVERTED">Revertidas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parceiro</TableHead>
                <TableHead>Patrocinador antigo</TableHead>
                <TableHead>Novo patrocinador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PENDING cancelados</TableHead>
                <TableHead>AVAILABLE revertidos</TableHead>
                <TableHead>Solicitado em</TableHead>
                <TableHead>Expira / Resolvido</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhuma solicitação encontrada
                  </TableCell>
                </TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div>{r.partner_name}</div>
                    {r.partner_email && <div className="text-xs text-muted-foreground">{r.partner_email}</div>}
                  </TableCell>
                  <TableCell>{r.old_sponsor_name}</TableCell>
                  <TableCell>
                    {r.new_sponsor_name || (r.status === 'EXPIRED' ? <span className="text-muted-foreground italic">Empresa</span> : '—')}
                  </TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs">
                    {r.cancelled_pending_count} · <span className="font-medium">{fmtBRL(r.cancelled_pending_total)}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.reversed_available_count} · <span className="font-medium">{fmtBRL(r.reversed_available_total)}</span>
                  </TableCell>
                  <TableCell className="text-xs">{format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell className="text-xs">
                    {r.resolved_at
                      ? format(new Date(r.resolved_at), 'dd/MM/yyyy HH:mm')
                      : format(new Date(r.expires_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da saída de rede</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Parceiro:</span><div className="font-medium">{detail.partner_name}</div></div>
                <div><span className="text-muted-foreground">Status:</span><div><StatusBadge status={detail.status} /></div></div>
                <div><span className="text-muted-foreground">Patrocinador antigo:</span><div className="font-medium">{detail.old_sponsor_name}</div></div>
                <div><span className="text-muted-foreground">Novo patrocinador:</span><div className="font-medium">{detail.new_sponsor_name || '—'}</div></div>
                <div><span className="text-muted-foreground">Posição binária antiga:</span><div>{detail.old_binary_position || '—'}</div></div>
                <div><span className="text-muted-foreground">IP:</span><div>{detail.ip_address || '—'}</div></div>
                <div><span className="text-muted-foreground">Solicitado em:</span><div>{format(new Date(detail.created_at), 'dd/MM/yyyy HH:mm')}</div></div>
                <div><span className="text-muted-foreground">Expira em:</span><div>{format(new Date(detail.expires_at), 'dd/MM/yyyy HH:mm')}</div></div>
                {detail.resolved_at && (
                  <div><span className="text-muted-foreground">Resolvido em:</span><div>{format(new Date(detail.resolved_at), 'dd/MM/yyyy HH:mm')}</div></div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <div className="text-muted-foreground text-xs">PENDING cancelados</div>
                  <div className="font-semibold">{detail.cancelled_pending_count} · {fmtBRL(detail.cancelled_pending_total)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">AVAILABLE revertidos</div>
                  <div className="font-semibold">{detail.reversed_available_count} · {fmtBRL(detail.reversed_available_total)}</div>
                </div>
              </div>

              {detail.reason && (
                <div className="pt-2 border-t">
                  <div className="text-muted-foreground text-xs mb-1">Motivo informado</div>
                  <div className="bg-muted/50 p-2 rounded text-xs whitespace-pre-wrap">{detail.reason}</div>
                </div>
              )}

              {detail.reminders_sent && Object.keys(detail.reminders_sent || {}).length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-muted-foreground text-xs mb-1">Lembretes enviados</div>
                  <pre className="bg-muted/50 p-2 rounded text-xs overflow-auto">{JSON.stringify(detail.reminders_sent, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminNetworkExitsTab;
