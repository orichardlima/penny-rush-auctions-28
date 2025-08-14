import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, RefreshCw, Search, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface AuditLogEntry {
  id: string;
  admin_user_id: string;
  admin_name: string;
  action_type: string;
  target_type: string;
  target_id: string;
  description: string;
  created_at: string;
}

const AuditLogTable: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('get_admin_audit_log', {
        limit_count: 100
      });

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar logs de auditoria');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = auditLogs.filter(log =>
    log.admin_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.target_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType.toUpperCase()) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'LOGIN': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTargetBadgeColor = (targetType: string) => {
    switch (targetType.toUpperCase()) {
      case 'AUCTION': return 'bg-purple-100 text-purple-800';
      case 'USER': return 'bg-blue-100 text-blue-800';
      case 'BID_PACKAGE': return 'bg-orange-100 text-orange-800';
      case 'SYSTEM': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Log de Auditoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Log de Auditoria
        </CardTitle>
        <CardDescription>
          Histórico de todas as ações administrativas realizadas no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controles */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por admin, ação, tipo ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
          <Button
            variant="outline"
            onClick={fetchAuditLogs}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-primary/5 rounded-lg">
            <p className="text-sm font-medium">Total de Logs</p>
            <p className="text-2xl font-bold text-primary">{auditLogs.length}</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-sm font-medium">Criações</p>
            <p className="text-2xl font-bold text-green-600">
              {auditLogs.filter(log => log.action_type === 'CREATE').length}
            </p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium">Atualizações</p>
            <p className="text-2xl font-bold text-blue-600">
              {auditLogs.filter(log => log.action_type === 'UPDATE').length}
            </p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-sm font-medium">Exclusões</p>
            <p className="text-2xl font-bold text-red-600">
              {auditLogs.filter(log => log.action_type === 'DELETE').length}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Tabela de logs */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Administrador</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{log.admin_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {log.admin_user_id.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getActionBadgeColor(log.action_type)}>
                      {log.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTargetBadgeColor(log.target_type)}>
                      {log.target_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="truncate" title={log.description}>
                      {log.description || 'Sem descrição'}
                    </div>
                    {log.target_id && (
                      <div className="text-xs text-muted-foreground font-mono mt-1">
                        ID: {log.target_id.slice(0, 8)}...
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredLogs.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>
              {searchTerm 
                ? 'Nenhum log encontrado para os critérios de busca'
                : 'Nenhum log de auditoria disponível'
              }
            </p>
          </div>
        )}

        {/* Informação sobre retenção */}
        <div className="text-xs text-muted-foreground text-center p-4 bg-muted/30 rounded-lg">
          <p>
            ℹ️ Os logs são mantidos por 90 dias para conformidade e auditoria.
            Logs críticos podem ser mantidos por períodos mais longos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuditLogTable;