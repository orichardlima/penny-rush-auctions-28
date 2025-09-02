import { useState, useEffect, useCallback } from 'react';

interface NetworkQuality {
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  ping: number;
  isOnline: boolean;
  adaptivePollingMs: number;
}

export const useNetworkQuality = () => {
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
    quality: 'good',
    ping: 0,
    isOnline: navigator.onLine,
    adaptivePollingMs: 2000
  });

  const measurePing = useCallback(async (): Promise<number> => {
    const start = performance.now();
    try {
      // Usar um endpoint rápido para testar latência
      await fetch('https://api.supabase.co/platform/status', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      const ping = performance.now() - start;
      console.log('📡 [NETWORK] Ping medido:', Math.round(ping), 'ms');
      return ping;
    } catch (error) {
      console.warn('📡 [NETWORK] Erro ao medir ping:', error);
      return 9999; // Ping alto indica problemas
    }
  }, []);

  const updateNetworkQuality = useCallback(async () => {
    const isOnline = navigator.onLine;
    
    if (!isOnline) {
      setNetworkQuality({
        quality: 'offline',
        ping: 9999,
        isOnline: false,
        adaptivePollingMs: 1000 // Tentar reconectar rapidamente
      });
      return;
    }

    const ping = await measurePing();
    let quality: NetworkQuality['quality'];
    let adaptivePollingMs: number;

    if (ping < 100) {
      quality = 'excellent';
      adaptivePollingMs = 5000; // Rede excelente: polling menos frequente
    } else if (ping < 300) {
      quality = 'good';
      adaptivePollingMs = 2000; // Rede boa: polling normal
    } else {
      quality = 'poor';
      adaptivePollingMs = 1000; // Rede ruim: polling mais frequente
    }

    console.log('📡 [NETWORK] Qualidade detectada:', {
      quality,
      ping: Math.round(ping),
      adaptivePollingMs
    });

    setNetworkQuality({
      quality,
      ping: Math.round(ping),
      isOnline: true,
      adaptivePollingMs
    });
  }, [measurePing]);

  useEffect(() => {
    // Medição inicial
    updateNetworkQuality();

    // Monitorar mudanças de conectividade
    const handleOnline = () => {
      console.log('🌐 [NETWORK] Conectado à internet');
      updateNetworkQuality();
    };

    const handleOffline = () => {
      console.log('🚫 [NETWORK] Desconectado da internet');
      setNetworkQuality(prev => ({
        ...prev,
        quality: 'offline',
        isOnline: false,
        adaptivePollingMs: 1000
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Medir qualidade da rede periodicamente
    const qualityInterval = setInterval(updateNetworkQuality, 30000); // A cada 30s

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(qualityInterval);
    };
  }, [updateNetworkQuality]);

  return networkQuality;
};