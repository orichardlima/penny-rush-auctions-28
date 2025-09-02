import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePageVisibility } from './usePageVisibility';
import { useNetworkQuality } from './useNetworkQuality';
import { useHeartbeat } from './useHeartbeat';
import { useBrowserIdlePrevention } from './useBrowserIdlePrevention';

export interface AuctionData {
  id: string;
  title: string;
  current_price: number;
  time_left: number;
  total_bids: number;
  status: string;
  winner_name?: string;
  ends_at?: string;
  image_url?: string;
  description?: string;
}

export const useAuctionRealtime = () => {
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'critical'>('good');
  const [retryCount, setRetryCount] = useState(0);
  
  const { toast } = useToast();
  const { isVisible } = usePageVisibility();
  const networkQuality = useNetworkQuality();
  const heartbeat = useHeartbeat(8000); // Heartbeat a cada 8 segundos
  
  // Usar browser idle prevention apenas quando há leilões ativos
  const hasActiveAuctions = auctions.some(a => a.status === 'active');
  useBrowserIdlePrevention(hasActiveAuctions);
  
  // Refs para controle de intervals e reconexão
  const channelRef = useRef<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout>();
  const emergencyIntervalRef = useRef<NodeJS.Timeout>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const syncAuctions = useCallback(async (source: string = 'MANUAL') => {
    try {
      console.log(`🔄 [SYNC-${source}] Fazendo sincronização`);
      const start = performance.now();
      
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      const duration = Math.round(performance.now() - start);

      if (error) {
        console.error(`❌ [SYNC-${source}] Erro na sincronização (${duration}ms):`, error);
        setRetryCount(prev => prev + 1);
        throw error;
      }

      if (data) {
        setAuctions(data);
        setLastSync(new Date());
        setRetryCount(0); // Reset retry count on success
        console.log(`✅ [SYNC-${source}] OK: ${data.length} leilões (${duration}ms)`);
        
        // Atualizar qualidade da conexão baseado na latência
        if (duration < 500) {
          setConnectionQuality('excellent');
        } else if (duration < 1000) {
          setConnectionQuality('good');
        } else if (duration < 2000) {
          setConnectionQuality('poor');
        } else {
          setConnectionQuality('critical');
        }
      }
    } catch (error) {
      console.error(`❌ [SYNC-${source}] Sincronização falhou:`, error);
      setConnectionQuality('critical');
      
      // Toast apenas se retry count for baixo (evitar spam)
      if (retryCount < 3) {
        toast({
          title: "Erro de conexão",
          description: "Problemas para sincronizar dados dos leilões",
          variant: "destructive",
        });
      }
    }
  }, [toast, retryCount]);

  // Sistema de reconexão com exponential backoff
  const reconnectWithBackoff = useCallback(async (attempt: number = 0) => {
    const maxAttempts = 10;
    const baseDelay = 1000;
    const maxDelay = 30000;
    
    if (attempt >= maxAttempts) {
      console.error('🚨 [RECONNECT] Máximo de tentativas atingido, recarregando página...');
      window.location.reload();
      return;
    }
    
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    console.log(`⏳ [RECONNECT] Tentativa ${attempt + 1}/${maxAttempts} em ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        await initializeRealtime();
      } catch (error) {
        console.error(`❌ [RECONNECT] Tentativa ${attempt + 1} falhou:`, error);
        reconnectWithBackoff(attempt + 1);
      }
    }, delay);
  }, []);

  const initializeRealtime = useCallback(async () => {
    try {
      console.log('🚀 [INIT] Inicializando sistema de conexão avançado');
      
      // Carregar dados iniciais
      await syncAuctions('INIT');

      // Limpar canal anterior se existir
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // Configurar realtime com retry automático
      channelRef.current = supabase
        .channel('auction-updates-enhanced')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'auctions'
          },
          (payload) => {
            const auction_id = (payload.new as any)?.id || (payload.old as any)?.id;
            const time_left = (payload.new as any)?.time_left;
            const status = (payload.new as any)?.status;
            
            console.log('🔄 [REALTIME] Update recebido:', {
              auction_id,
              time_left,
              status,
              event: payload.eventType,
              timestamp: new Date().toISOString()
            });
            
            setAuctions(current => {
              if (payload.eventType === 'DELETE') {
                return current.filter(a => a.id !== (payload.old as any).id);
              }
              
              if (payload.eventType === 'INSERT') {
                return [payload.new as AuctionData, ...current];
              }
              
              if (payload.eventType === 'UPDATE') {
                return current.map(auction => 
                  auction.id === auction_id 
                    ? { ...auction, ...payload.new }
                    : auction
                );
              }
              
              return current;
            });
            
            setLastSync(new Date());
            setRetryCount(0); // Reset on successful realtime update
          }
        )
        .subscribe((status) => {
          console.log('🔌 [REALTIME] Status da conexão:', status);
          const connected = status === 'SUBSCRIBED';
          setIsConnected(connected);
          
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.warn('⚠️ [REALTIME] Conexão perdida, iniciando reconexão automática');
            reconnectWithBackoff(0);
          } else if (status === 'SUBSCRIBED') {
            console.log('✅ [REALTIME] Conectado com sucesso');
            setRetryCount(0);
          }
        });

      console.log('✅ [INIT] Sistema inicializado com sucesso');
      
    } catch (error) {
      console.error('❌ [INIT] Erro na inicialização:', error);
      toast({
        title: "Erro de inicialização", 
        description: "Falha ao conectar com o sistema de leilões",
        variant: "destructive",
      });
      
      // Tentar reconectar após erro de inicialização
      reconnectWithBackoff(0);
    }
  }, [syncAuctions, toast, reconnectWithBackoff]);

  // Configurar polling adaptativo baseado na qualidade da rede e estado da página
  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    if (emergencyIntervalRef.current) {
      clearInterval(emergencyIntervalRef.current);
    }

    // Determinar intervalo de polling baseado em múltiplos fatores
    let pollingInterval = networkQuality.adaptivePollingMs;
    
    // Ajustar baseado na visibilidade da página
    if (!isVisible) {
      pollingInterval = Math.min(pollingInterval * 2, 10000); // Menos frequente quando hidden
    }
    
    // Ajustar baseado no estado da conexão
    if (!isConnected) {
      pollingInterval = Math.min(pollingInterval / 2, 2000); // Mais frequente quando desconectado
    }
    
    // Ajustar baseado no heartbeat
    if (!heartbeat.isAlive) {
      pollingInterval = 1000; // Polling ultra agressivo quando heartbeat falha
    }

    console.log(`⏰ [POLLING] Configurado para ${pollingInterval}ms (Network: ${networkQuality.quality}, Visible: ${isVisible}, Connected: ${isConnected}, Heartbeat: ${heartbeat.isAlive})`);

    // Polling principal
    pollIntervalRef.current = setInterval(() => {
      syncAuctions('POLL');
    }, pollingInterval);

    // Polling de emergência ultra-agressivo quando necessário
    if (!isConnected || !heartbeat.isAlive || connectionQuality === 'critical') {
      emergencyIntervalRef.current = setInterval(() => {
        syncAuctions('EMERGENCY');
      }, 500); // 500ms de polling de emergência
      
      console.log('🚨 [EMERGENCY-POLLING] Ativado (500ms)');
    }

  }, [networkQuality, isVisible, isConnected, heartbeat.isAlive, connectionQuality, syncAuctions]);

  // Reconectar imediatamente quando página volta ao foco
  useEffect(() => {
    if (isVisible && (!isConnected || !heartbeat.isAlive)) {
      console.log('👁️ [FOCUS] Página voltou ao foco, reconectando...');
      initializeRealtime();
      syncAuctions('FOCUS');
    }
  }, [isVisible, isConnected, heartbeat.isAlive, initializeRealtime, syncAuctions]);

  // Inicialização principal
  useEffect(() => {
    initializeRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (emergencyIntervalRef.current) {
        clearInterval(emergencyIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []); // Remover dependências para evitar re-runs desnecessários

  return {
    auctions,
    isConnected,
    lastSync,
    connectionQuality,
    networkQuality: networkQuality.quality,
    heartbeatStatus: heartbeat.isAlive,
    retryCount,
    forceSync: () => syncAuctions('MANUAL')
  };
};