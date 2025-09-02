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
  return;
};