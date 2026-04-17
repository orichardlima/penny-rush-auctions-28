import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollText, RefreshCw } from 'lucide-react';
import { useManagerAudit } from '@/hooks/useManagerAudit';

interface Props {
  managerAffiliateId: string | null;
}

const actionLabel: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  linked: { label: 'Vinculado', variant: 'default' },
  unlinked: { label: 'Desvinculado', variant: 'destructive' },
  status_changed: { label: 'Status alterado', variant: 'secondary' },
  override_rate_changed: { label: 'Taxa alterada', variant: 'outline' },
};

export const ManagerAuditHistory: React.FC<Props> = ({ managerAffiliateId }) => {
  const { entries, loading, refetch } = useManagerAudit(managerAffiliateId);

  const formatDate = (s: string) =>
    new Date(s).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const renderChange = (entry: any) => {
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
              Histórico de Ações
            </CardTitle>
            <CardDescription>
              Log de todas as ações realizadas na sua rede de influencers
            </CardDescription>
          </div>
          <Button onClick={refetch} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Influencer</TableHead>
                  <TableHead>Mudança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => {
                  const action = actionLabel[entry.action_type] || { label: entry.action_type, variant: 'outline' as const };
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">{formatDate(entry.created_at)}</TableCell>
                      <TableCell><Badge variant={action.variant}>{action.label}</Badge></TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.influencer_name || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{entry.influencer_code || '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm">{renderChange(entry)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {loading ? 'Carregando histórico...' : 'Nenhuma ação registrada ainda'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
