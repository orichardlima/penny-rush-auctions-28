import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HeartbeatStatus {
  isAlive: boolean;
  lastHeartbeat: Date | null;
  consecutiveFailures: number;
  pingMs: number;
}

export const useHeartbeat = (intervalMs: number = 10000) => {
  const [status, setStatus] = useState<HeartbeatStatus>({
    isAlive: true,
    lastHeartbeat: null,
    consecutiveFailures: 0,
    pingMs: 0
  });

  const intervalRef = useRef<NodeJS.Timeout>();
  const isRunningRef = useRef(false);

  const sendHeartbeat = useCallback(async (): Promise<boolean> => {
    if (isRunningRef.current) return false; // Evitar overlapping
    
    isRunningRef.current = true;
    const start = performance.now();
    
    try {
      // Usar uma query simples e rápida como heartbeat
      const { error } = await supabase
        .from('auctions')
        .select('id')
        .limit(1);

      const pingMs = Math.round(performance.now() - start);
      
      if (error) {
        console.warn('💔 [HEARTBEAT] Erro na conexão:', error);
        setStatus(prev => ({
          isAlive: false,
          lastHeartbeat: prev.lastHeartbeat,
          consecutiveFailures: prev.consecutiveFailures + 1,
          pingMs
        }));
        return false;
      }

      console.log(`💓 [HEARTBEAT] OK - ${pingMs}ms`);
      setStatus({
        isAlive: true,
        lastHeartbeat: new Date(),
        consecutiveFailures: 0,
        pingMs
      });
      return true;

    } catch (error) {
      console.error('💔 [HEARTBEAT] Falha crítica:', error);
      setStatus(prev => ({
        isAlive: false,
        lastHeartbeat: prev.lastHeartbeat,
        consecutiveFailures: prev.consecutiveFailures + 1,
        pingMs: 9999
      }));
      return false;
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Heartbeat inicial
    sendHeartbeat();

    // Heartbeat periódico
    intervalRef.current = setInterval(sendHeartbeat, intervalMs);
    
    console.log(`💓 [HEARTBEAT] Iniciado (${intervalMs}ms)`);
  }, [sendHeartbeat, intervalMs]);

  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    console.log('💓 [HEARTBEAT] Parado');
  }, []);

  useEffect(() => {
    startHeartbeat();
    return stopHeartbeat;
  }, [startHeartbeat, stopHeartbeat]);

  return {
    ...status,
    sendHeartbeat,
    startHeartbeat,
    stopHeartbeat
  };
};