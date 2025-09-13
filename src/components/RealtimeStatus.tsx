import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
interface RealtimeStatusProps {
  isConnected: boolean;
  lastSync: Date | null;
  onForceSync: () => void;
}
export const RealtimeStatus = ({
  isConnected,
  lastSync,
  onForceSync
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
  const isStale = lastSync && new Date().getTime() - lastSync.getTime() > 60000;
  
  return (
    <div className="flex items-center gap-2 p-2 bg-card rounded-lg border">
      <div className="flex items-center gap-2">
        {isConnected ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        <Badge variant={isConnected ? "default" : "destructive"}>
          {isConnected ? "Conectado" : "Desconectado"}
        </Badge>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Última sincronização: {getLastSyncText()}
        {isStale && <span className="text-yellow-500 ml-1">⚠️</span>}
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onForceSync}
        disabled={isConnected}
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Sincronizar
      </Button>
    </div>
  );
};