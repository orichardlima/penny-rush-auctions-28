import { Wifi, WifiOff, RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RealtimeStatusProps {
  isConnected: boolean;
  lastSync: Date | null;
  onForceSync: () => void;
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'critical';
  networkQuality?: 'excellent' | 'good' | 'poor' | 'offline';
  heartbeatStatus?: boolean;
  retryCount?: number;
}

export const RealtimeStatus = ({ 
  isConnected, 
  lastSync, 
  onForceSync, 
  connectionQuality = 'good',
  networkQuality = 'good',
  heartbeatStatus = true,
  retryCount = 0
}: RealtimeStatusProps) => {
  const getLastSyncText = () => {
    if (!lastSync) return 'Nunca';
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s atrás`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour}h atrás`;
  };

  const isStale = lastSync && (new Date().getTime() - lastSync.getTime()) > 60000;
  const hasProblems = !isConnected || !heartbeatStatus || connectionQuality === 'critical' || networkQuality === 'offline';

  const getConnectionIcon = () => {
    if (!isConnected || !heartbeatStatus) return <WifiOff className="h-3 w-3" />;
    if (connectionQuality === 'excellent') return <CheckCircle className="h-3 w-3" />;
    if (connectionQuality === 'critical') return <XCircle className="h-3 w-3" />;
    return <Wifi className="h-3 w-3" />;
  };

  const getBadgeVariant = () => {
    if (!heartbeatStatus || networkQuality === 'offline') return "destructive";
    if (!isConnected || connectionQuality === 'critical') return "destructive";
    if (connectionQuality === 'poor' || networkQuality === 'poor') return "secondary";
    if (connectionQuality === 'excellent' && networkQuality === 'excellent') return "default";
    return "default";
  };

  const getStatusText = () => {
    if (!heartbeatStatus) return 'Sem Heartbeat';
    if (networkQuality === 'offline') return 'Sem Internet';
    if (!isConnected) return 'Desconectado';
    if (connectionQuality === 'critical') return 'Crítico';
    if (connectionQuality === 'poor') return 'Instável';
    if (connectionQuality === 'excellent') return 'Excelente';
    return 'Online';
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant={getBadgeVariant()} className="gap-1">
        {getConnectionIcon()}
        {getStatusText()}
      </Badge>
      
      {networkQuality && networkQuality !== 'good' && (
        <Badge variant="outline" className="gap-1">
          <Activity className="h-3 w-3" />
          Rede: {networkQuality}
        </Badge>
      )}
      
      {retryCount > 0 && (
        <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {retryCount} tentativas
        </Badge>
      )}
      
      <span className={`text-muted-foreground ${isStale ? 'text-destructive' : ''}`}>
        {getLastSyncText()}
      </span>
      
      {(hasProblems || isStale) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onForceSync}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reconectar
        </Button>
      )}
    </div>
  );
};