import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollText, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuditRow {
  id: string;
  action_type: string;
  manager_affiliate_id: string;
  influencer_affiliate_id: string;
  performed_by: string;
  old_value: any;
  new_value: any;
  notes: string | null;
  created_at: string;
  manager_code?: string;
  manager_name?: string;
  influencer_code?: string;
  influencer_name?: string;
}

const actionLabel: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  linked: { label: 'Vinculado', variant: 'default' },
  unlinked: { label: 'Desvinculado', variant: 'destructive' },
  status_changed: { label: 'Status alterado', variant: 'secondary' },
  override_rate_changed: { label: 'Taxa alterada', variant: 'outline' },
};

export const AdminAffiliateAuditLog: React.FC = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('affiliate_manager_audit' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200) as any);

      if (error) throw error;

      const list = (data || []) as any[];
      const allAffIds = [...new Set([
        ...list.map(r => r.manager_affiliate_id),
        ...list.map(r => r.influencer_affiliate_id),
      ])];

      const { data: affs } = await supabase
        .from('affiliates')
        .select('id, affiliate_code, user_id')
        .in('id', allAffIds);

      const userIds = (affs || []).map(a => a.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      const affMap = new Map(
        (affs || []).map(a => [a.id, {
          code: a.affiliate_code,
          name: profileMap.get(a.user_id) || 'Sem nome',
        }])
      );

      setRows(list.map(r => ({
        ...r,
        manager_code: affMap.get(r.manager_affiliate_id)?.code,
        manager_name: affMap.get(r.manager_affiliate_id)?.name,
        influencer_code: affMap.get(r.influencer_affiliate_id)?.code,
        influencer_name: affMap.get(r.influencer_affiliate_id)?.name,
      })));
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: 'Erro ao carregar log de auditoria', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); }, []);

  const formatDate = (s: string) =>
    new Date(s).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const filtered = rows.filter(r => {
    const matchesSearch = !search ||
      (r.manager_name?.toLowerCase().includes(search.toLowerCase())) ||
      (r.influencer_name?.toLowerCase().includes(search.toLowerCase())) ||
      (r.manager_code?.toLowerCase().includes(search.toLowerCase())) ||
      (r.influencer_code?.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === 'all' || r.action_type === filter;
    return matchesSearch && matchesFilter;
  });

  const renderChange = (entry: AuditRow) => {
    if (entry.action_type === 'override_rate_changed') {
      return `${entry.old_value?.override_rate}% → ${entry.new_value?.override_rate}%`;
    }
    if (entry.action_type === 'status_changed') {
      return `${entry.old_value?.status} → ${entry.new_value?.status}`;
    }
    if (entry.action_type === 'linked') {
      return `Override: ${entry.new_value?.override_rate}%`;
    }
    if (entry.action_type === 'unlinked') {
      return `Era ${entry.old_value?.override_rate}%`;
    }
    return '—';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Auditoria — Hierarquia de Afiliados
            </CardTitle>
            <CardDescription>
              Histórico completo de vínculos, alterações de taxa e mudanças de status
            </CardDescription>
          </div>
          <Button onClick={fetchAudit} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por manager ou influencer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder="Filtrar por ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="linked">Vinculado</SelectItem>
              <SelectItem value="unlinked">Desvinculado</SelectItem>
              <SelectItem value="status_changed">Status alterado</SelectItem>
              <SelectItem value="override_rate_changed">Taxa alterada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Influencer</TableHead>
                  <TableHead>Mudança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const action = actionLabel[r.action_type] || { label: r.action_type, variant: 'outline' as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{formatDate(r.created_at)}</TableCell>
                      <TableCell><Badge variant={action.variant}>{action.label}</Badge></TableCell>
                      <TableCell>
                        <div className="font-medium">{r.manager_name || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.manager_code || '—'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.influencer_name || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.influencer_code || '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm">{renderChange(r)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {loading ? 'Carregando...' : 'Nenhuma entrada encontrada'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
