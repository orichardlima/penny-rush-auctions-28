import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Shield, 
  Eye, 
  AlertTriangle, 
  User, 
  Settings, 
  FileText, 
  Clock,
  Search,
  Filter,
  Download,
  RefreshCw,
  Activity,
  Database,
  Lock,
  Unlock,
  Edit,
  Trash2,
  Plus
} from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values: any;
  new_values: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failed' | 'warning';
  details: string;
  user_profile?: {
    full_name: string;
    email: string;
    is_admin: boolean;
  };
}

interface SecurityEvent {
  id: string;
  event_type: string;
  user_id: string;
  ip_address: string;
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  created_at: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
}

interface SystemEvent {
  id: string;
  event_type: string;
  service: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  created_at: string;
  metadata: any;
}

export const AuditLogsTab: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    severity: '',
    status: '',
    dateRange: '7d'
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Create audit log entry
  const createAuditLog = async (logData: Partial<AuditLog>) => {
    try {
      // Mock audit log creation since table doesn't exist yet
      console.log('Audit log would be created:', {
        user_id: user?.id,
        ip_address: await getClientIP(),
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString(),
        ...logData
      });
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  };

  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      // Since we don't have an audit_logs table yet, we'll use mock data
      // In a real implementation, you would create this table and populate it
      const mockAuditLogs: AuditLog[] = [
        {
          id: '1',
          user_id: user?.id || '',
          action: 'CREATE_AUCTION',
          resource_type: 'auction',
          resource_id: 'auction-123',
          old_values: null,
          new_values: { title: 'iPhone 15 Pro', starting_price: 100 },
          ip_address: '192.168.1.1',
          user_agent: navigator.userAgent,
          created_at: new Date().toISOString(),
          severity: 'medium',
          status: 'success',
          details: 'Novo leilão criado com sucesso',
          user_profile: {
            full_name: 'Admin User',
            email: 'admin@example.com',
            is_admin: true
          }
        },
        {
          id: '2',
          user_id: user?.id || '',
          action: 'UPDATE_USER',
          resource_type: 'user',
          resource_id: 'user-456',
          old_values: { is_admin: false },
          new_values: { is_admin: true },
          ip_address: '192.168.1.1',
          user_agent: navigator.userAgent,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          severity: 'high',
          status: 'success',
          details: 'Permissões de administrador concedidas',
          user_profile: {
            full_name: 'Admin User',
            email: 'admin@example.com',
            is_admin: true
          }
        },
        {
          id: '3',
          user_id: 'unknown',
          action: 'FAILED_LOGIN',
          resource_type: 'auth',
          resource_id: 'login-attempt',
          old_values: null,
          new_values: null,
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          severity: 'high',
          status: 'failed',
          details: 'Tentativa de login falhada - credenciais inválidas',
          user_profile: undefined
        }
      ];

      // Log this action
      await createAuditLog({
        action: 'VIEW_AUDIT_LOGS',
        resource_type: 'audit',
        resource_id: 'audit-logs-tab',
        severity: 'low',
        status: 'success',
        details: 'Visualização dos logs de auditoria'
      });

      setAuditLogs(mockAuditLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar logs de auditoria',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityEvents = async () => {
    try {
      const mockSecurityEvents: SecurityEvent[] = [
        {
          id: '1',
          event_type: 'MULTIPLE_FAILED_LOGINS',
          user_id: 'unknown',
          ip_address: '192.168.1.100',
          threat_level: 'high',
          description: 'Múltiplas tentativas de login falhadas do mesmo IP',
          created_at: new Date().toISOString(),
          resolved: false
        },
        {
          id: '2',
          event_type: 'UNUSUAL_BID_PATTERN',
          user_id: 'user-789',
          ip_address: '10.0.0.1',
          threat_level: 'medium',
          description: 'Padrão suspeito de lances detectado',
          created_at: new Date(Date.now() - 1800000).toISOString(),
          resolved: true,
          resolved_by: user?.id,
          resolved_at: new Date(Date.now() - 900000).toISOString()
        }
      ];

      setSecurityEvents(mockSecurityEvents);
    } catch (error) {
      console.error('Error fetching security events:', error);
    }
  };

  const fetchSystemEvents = async () => {
    try {
      const mockSystemEvents: SystemEvent[] = [
        {
          id: '1',
          event_type: 'DATABASE_BACKUP',
          service: 'database',
          message: 'Backup automático realizado com sucesso',
          level: 'info',
          created_at: new Date().toISOString(),
          metadata: { backup_size: '2.1 GB', duration: '45s' }
        },
        {
          id: '2',
          event_type: 'HIGH_CPU_USAGE',
          service: 'server',
          message: 'Alto uso de CPU detectado (85%)',
          level: 'warning',
          created_at: new Date(Date.now() - 1800000).toISOString(),
          metadata: { cpu_percentage: 85, duration: '10 minutes' }
        },
        {
          id: '3',
          event_type: 'EDGE_FUNCTION_ERROR',
          service: 'edge-functions',
          message: 'Erro na função de processamento de pagamentos',
          level: 'error',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          metadata: { function_name: 'process-payment', error_count: 3 }
        }
      ];

      setSystemEvents(mockSystemEvents);
    } catch (error) {
      console.error('Error fetching system events:', error);
    }
  };

  const resolveSecurityEvent = async (eventId: string) => {
    try {
      // In a real implementation, update the security event in the database
      setSecurityEvents(prev => 
        prev.map(event => 
          event.id === eventId 
            ? { ...event, resolved: true, resolved_by: user?.id, resolved_at: new Date().toISOString() }
            : event
        )
      );

      await createAuditLog({
        action: 'RESOLVE_SECURITY_EVENT',
        resource_type: 'security',
        resource_id: eventId,
        severity: 'medium',
        status: 'success',
        details: `Evento de segurança ${eventId} resolvido`
      });

      toast({
        title: 'Sucesso',
        description: 'Evento de segurança marcado como resolvido'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao resolver evento de segurança',
        variant: 'destructive'
      });
    }
  };

  const exportLogs = async () => {
    try {
      const logsToExport = auditLogs.map(log => ({
        'Data/Hora': format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
        'Usuário': log.user_profile?.full_name || 'Sistema',
        'Ação': log.action,
        'Recurso': log.resource_type,
        'Severidade': log.severity,
        'Status': log.status,
        'IP': log.ip_address,
        'Detalhes': log.details
      }));

      const csvContent = [
        Object.keys(logsToExport[0]).join(','),
        ...logsToExport.map(row => Object.values(row).map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      await createAuditLog({
        action: 'EXPORT_AUDIT_LOGS',
        resource_type: 'audit',
        resource_id: 'export',
        severity: 'medium',
        status: 'success',
        details: 'Logs de auditoria exportados'
      });

      toast({
        title: 'Sucesso',
        description: 'Logs exportados com sucesso!'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao exportar logs',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchSecurityEvents();
    fetchSystemEvents();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <Shield className="h-4 w-4" />;
      case 'medium': return <Eye className="h-4 w-4" />;
      case 'low': return <Activity className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('CREATE')) return <Plus className="h-4 w-4" />;
    if (action.includes('UPDATE')) return <Edit className="h-4 w-4" />;
    if (action.includes('DELETE')) return <Trash2 className="h-4 w-4" />;
    if (action.includes('LOGIN')) return <Lock className="h-4 w-4" />;
    if (action.includes('LOGOUT')) return <Unlock className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = !filters.action || filters.action === 'all' || log.action === filters.action;
    const matchesResourceType = !filters.resourceType || filters.resourceType === 'all' || log.resource_type === filters.resourceType;
    const matchesSeverity = !filters.severity || filters.severity === 'all' || log.severity === filters.severity;
    const matchesStatus = !filters.status || filters.status === 'all' || log.status === filters.status;

    return matchesSearch && matchesAction && matchesResourceType && matchesSeverity && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div>
          <h2 className="text-2xl font-bold">Auditoria e Logs</h2>
          <p className="text-muted-foreground">
            Monitoramento de segurança e atividades do sistema
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={fetchAuditLogs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={exportLogs} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Security Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">Eventos Críticos</p>
                <p className="text-lg font-bold">
                  {securityEvents.filter(e => e.threat_level === 'critical').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground">Não Resolvidos</p>
                <p className="text-lg font-bold text-warning">
                  {securityEvents.filter(e => !e.resolved).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Ações Hoje</p>
                <p className="text-lg font-bold">
                  {auditLogs.filter(log => 
                    new Date(log.created_at).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Total de Logs</p>
                <p className="text-lg font-bold">{auditLogs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">Logs de Auditoria</TabsTrigger>
          <TabsTrigger value="security">Eventos de Segurança</TabsTrigger>
          <TabsTrigger value="system">Eventos do Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <Label>Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label>Ação</Label>
                  <Select value={filters.action} onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="CREATE_AUCTION">Criar Leilão</SelectItem>
                      <SelectItem value="UPDATE_USER">Atualizar Usuário</SelectItem>
                      <SelectItem value="FAILED_LOGIN">Login Falhou</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Recurso</Label>
                  <Select value={filters.resourceType} onValueChange={(value) => setFilters(prev => ({ ...prev, resourceType: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="auction">Leilão</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="auth">Autenticação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severidade</Label>
                  <Select value={filters.severity} onValueChange={(value) => setFilters(prev => ({ ...prev, severity: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="success">Sucesso</SelectItem>
                      <SelectItem value="failed">Falha</SelectItem>
                      <SelectItem value="warning">Aviso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Período</Label>
                  <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">Último Dia</SelectItem>
                      <SelectItem value="7d">Últimos 7 Dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 Dias</SelectItem>
                      <SelectItem value="90d">Últimos 90 Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria ({filteredLogs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {log.user_profile?.full_name || 'Sistema'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            {log.action.replace(/_/g, ' ')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.resource_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSeverityColor(log.severity)} className="gap-1">
                            {getSeverityIcon(log.severity)}
                            {log.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.ip_address}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Eventos de Segurança</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {securityEvents.map((event) => (
                  <div key={event.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityColor(event.threat_level)}>
                          {event.threat_level}
                        </Badge>
                        <span className="font-medium">{event.event_type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.resolved ? (
                          <Badge variant="default">Resolvido</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => resolveSecurityEvent(event.id)}
                          >
                            Resolver
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>IP: {event.ip_address}</span>
                      <span>Data: {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      {event.resolved && event.resolved_at && (
                        <span>Resolvido em: {format(new Date(event.resolved_at), 'dd/MM/yyyy HH:mm')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Eventos do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemEvents.map((event) => (
                  <div key={event.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={event.level === 'error' ? 'destructive' : event.level === 'warning' ? 'default' : 'secondary'}>
                          {event.level}
                        </Badge>
                        <span className="font-medium">{event.service}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm mb-2">{event.message}</p>
                    {event.metadata && (
                      <div className="text-xs text-muted-foreground">
                        Metadata: {JSON.stringify(event.metadata)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Log Detail Modal */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Detalhes do Log</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data/Hora</Label>
                    <p>{format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss')}</p>
                  </div>
                  <div>
                    <Label>Usuário</Label>
                    <p>{selectedLog.user_profile?.full_name || 'Sistema'}</p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p>{selectedLog.user_profile?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <Label>IP Address</Label>
                    <p className="font-mono">{selectedLog.ip_address}</p>
                  </div>
                  <div>
                    <Label>Ação</Label>
                    <p>{selectedLog.action}</p>
                  </div>
                  <div>
                    <Label>Recurso</Label>
                    <p>{selectedLog.resource_type} ({selectedLog.resource_id})</p>
                  </div>
                  <div>
                    <Label>Severidade</Label>
                    <Badge variant={getSeverityColor(selectedLog.severity)}>
                      {selectedLog.severity}
                    </Badge>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Badge variant={selectedLog.status === 'success' ? 'default' : 'destructive'}>
                      {selectedLog.status}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <Label>Detalhes</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedLog.details}</p>
                </div>

                <div>
                  <Label>User Agent</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md text-xs font-mono break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>

                {selectedLog.old_values && (
                  <div>
                    <Label>Valores Anteriores</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_values && (
                  <div>
                    <Label>Novos Valores</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};