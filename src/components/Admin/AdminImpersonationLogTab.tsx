import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Eye, KeyRound, Shield, Loader2 } from 'lucide-react';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';

interface LogRow {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  target_email: string | null;
  mode: 'view_as' | 'login_as';
  reason: string;
  ip_address: string | null;
  user_agent: string | null;
  started_at: string;
  ended_at: string | null;
}

export const AdminImpersonationLogTab: React.FC = () => {
  const { isSuperAdmin, loading: loadingPerm } = useIsSuperAdmin();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('admin_impersonation_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(500);
      setRows((data ?? []) as LogRow[]);
      setLoading(false);
    })();
  }, [isSuperAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.target_email?.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      r.target_user_id.includes(q)
    );
  }, [rows, search]);

  if (loadingPerm) return null;
  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Shield className="h-6 w-6 mx-auto mb-2 opacity-50" />
          Acesso restrito ao super-admin.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Auditoria de Acessos</CardTitle>
        <CardDescription>Registro de toda visualização ou impersonation feita pelo super-admin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input placeholder="Buscar por e-mail, motivo ou user_id..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const dur = r.ended_at
                    ? `${Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000)} min`
                    : '—';
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.started_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        {r.mode === 'login_as' ? (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-300"><KeyRound className="h-3 w-3 mr-1" />Acessou</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-300"><Eye className="h-3 w-3 mr-1" />Visualizou</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{r.target_email ?? r.target_user_id}</TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={r.reason}>{r.reason}</TableCell>
                      <TableCell className="text-xs">{r.ip_address ?? '—'}</TableCell>
                      <TableCell className="text-xs">{dur}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminImpersonationLogTab;
