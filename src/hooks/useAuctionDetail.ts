import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePageVisibility } from './usePageVisibility';
import { useNetworkQuality } from './useNetworkQuality';
import { useHeartbeat } from './useHeartbeat';
import { useBrowserIdlePrevention } from './useBrowserIdlePrevention';

interface AuctionDetail {
  id: string;
  current_price: number;
  total_bids: number;
  time_left: number;
  ends_at: string;
  status: string;
  winner_id?: string;
  winner_name?: string;
}

export const useAuctionDetail = (auctionId?: string) => {
  const [auctionData, setAuctionData] = useState<AuctionDetail | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isWaitingFinalization, setIsWaitingFinalization] = useState(false);
  const [finalizationMessage, setFinalizationMessage] = useState('');
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'critical'>('good');
  const [retryCount, setRetryCount] = useState(0);
  
  // Hooks para sistema de conexão robusta
  const { isVisible } = usePageVisibility();
  const networkQuality = useNetworkQuality();
  const heartbeat = useHeartbeat(5000); // Heartbeat mais frequente para leilão específico
  
  // Usar browser idle prevention para leilões ativos
  const isActiveAuction = auctionData?.status === 'active';
  useBrowserIdlePrevention(isActiveAuction);
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const emergencyIntervalRef = useRef<NodeJS.Timeout>();
  const finalizationTimeoutRef = useRef<NodeJS.Timeout>();
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Mensagens rotativas para aguardar finalização
  const finalizationMessages = [
    'Aguarde um momento',
    'Finalizando leilão',
    'Conferindo lances válidos',
    'Definindo vencedor'
  ];

  // Controla as mensagens rotativas quando aguardando finalização
  useEffect(() => {
    if (!isWaitingFinalization) {
      if (finalizationTimeoutRef.current) {
        clearTimeout(finalizationTimeoutRef.current);
        finalizationTimeoutRef.current = undefined;
      }
      return;
    }

    let messageIndex = 0;
    setFinalizationMessage(finalizationMessages[0]);

    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % finalizationMessages.length;
      setFinalizationMessage(finalizationMessages[messageIndex]);
    }, 1000);

    // Timeout de proteção de 15 segundos
    finalizationTimeoutRef.current = setTimeout(() => {
      console.log('⚠️ [FINALIZATION] Timeout de proteção ativado');
      setIsWaitingFinalization(false);
    }, 15000);

    return () => {
      clearInterval(messageInterval);
      if (finalizationTimeoutRef.current) {
        clearTimeout(finalizationTimeoutRef.current);
        finalizationTimeoutRef.current = undefined;
      }
    };
  }, [isWaitingFinalization]);

  const fetchAuctionData = useCallback(async (source: string = 'MANUAL') => {
    if (!auctionId) return;
    
    try {
      console.log(`🎯 [${auctionId}] Sync ${source} iniciado`);
      const start = performance.now();
      
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .maybeSingle();
      
      const duration = Math.round(performance.now() - start);
      
      if (error) {
        console.error(`❌ [${auctionId}] Erro ${source} (${duration}ms):`, error);
        setRetryCount(prev => prev + 1);
        setConnectionQuality('critical');
        throw error;
      }
      
      if (data) {
        console.log(`🎯 [${auctionId}] ${source}: Timer ${data.time_left}s | Status ${data.status} (${duration}ms)`);
        setAuctionData(data);
        setLastSync(new Date());
        setRetryCount(0);
        
        // Atualizar qualidade da conexão
        if (duration < 300) {
          setConnectionQuality('excellent');
        } else if (duration < 800) {
          setConnectionQuality('good');
        } else if (duration < 1500) {
          setConnectionQuality('poor');
        } else {
          setConnectionQuality('critical');
        }
        
        // Sincronizar timer local com dados do banco
        if (data.status === 'active' && data.time_left > 0) {
          setLocalTimeLeft(data.time_left);
        } else {
          setLocalTimeLeft(null);
        }
        
        // Se leilão foi finalizado, sair do estado de finalização
        if (data.status === 'finished') {
          setIsWaitingFinalization(false);
        } else if (data.status === 'active' && data.time_left === 0) {
          // Leilão ativo com timer zero - mostrar finalização
          setIsWaitingFinalization(true);
        } else if (data.time_left > 0) {
          // Timer ativo - sair da finalização
          setIsWaitingFinalization(false);
        }
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao buscar dados (${source}):`, error);
      setConnectionQuality('critical');
    }
  }, [auctionId]);

  // Sistema de reconexão com exponential backoff específico para leilão
  const reconnectWithBackoff = useCallback(async (attempt: number = 0) => {
    if (!auctionId) return;
    
    const maxAttempts = 8;
    const baseDelay = 500; // Mais rápido para leilão específico
    const maxDelay = 15000;
    
    if (attempt >= maxAttempts) {
      console.error(`🚨 [${auctionId}] Máximo de tentativas de reconexão atingido`);
      // Para leilão específico, não recarregar página, apenas alertar
      return;
    }
    
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    console.log(`⏳ [${auctionId}] Reconexão tentativa ${attempt + 1}/${maxAttempts} em ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        await initializeDetailRealtime();
      } catch (error) {
        console.error(`❌ [${auctionId}] Tentativa ${attempt + 1} falhou:`, error);
        reconnectWithBackoff(attempt + 1);
      }
    }, delay);
  }, [auctionId]);

  const initializeDetailRealtime = useCallback(async () => {
    if (!auctionId) return;

    try {
      console.log(`🚀 [${auctionId}] Inicializando sistema robusto de conexão`);
      
      // Buscar dados iniciais
      await fetchAuctionData('INIT');

      // Limpar canal anterior se existir
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // Configurar realtime com retry automático
      channelRef.current = supabase
        .channel(`auction-detail-enhanced-${auctionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'auctions',
            filter: `id=eq.${auctionId}`
          },
          (payload) => {
            const newData = payload.new as AuctionDetail;
            console.log(`🎯 [${auctionId}] REALTIME: Timer ${newData.time_left}s | Status ${newData.status}`);
            
            setAuctionData(newData);
            setLastSync(new Date());
            setRetryCount(0);
            
            // Sincronizar timer local com dados do realtime
            if (newData.status === 'active' && newData.time_left > 0) {
              setLocalTimeLeft(newData.time_left);
            } else {
              setLocalTimeLeft(null);
            }
            
            // Lógica de finalização baseada no novo sistema
            if (newData.status === 'finished') {
              setIsWaitingFinalization(false);
            } else if (newData.status === 'active' && newData.time_left === 0) {
              setIsWaitingFinalization(true);
            } else if (newData.time_left > 0) {
              setIsWaitingFinalization(false);
            }
          }
        )
        .subscribe((status) => {
          console.log(`🔌 [${auctionId}] Realtime status:`, status);
          const connected = status === 'SUBSCRIBED';
          setIsConnected(connected);
          
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.warn(`⚠️ [${auctionId}] Conexão perdida, iniciando reconexão`);
            reconnectWithBackoff(0);
          } else if (status === 'SUBSCRIBED') {
            console.log(`✅ [${auctionId}] Reconectado com sucesso`);
            setRetryCount(0);
          }
        });

      console.log(`✅ [${auctionId}] Sistema inicializado`);
      
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na inicialização:`, error);
      reconnectWithBackoff(0);
    }
  }, [auctionId, fetchAuctionData, reconnectWithBackoff]);

  // Configurar polling ultra-adaptativo para leilão específico
  useEffect(() => {
    if (!auctionId) return;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (emergencyIntervalRef.current) {
      clearInterval(emergencyIntervalRef.current);
    }

    // Determinar intervalo baseado em múltiplos fatores
    let pollingInterval = networkQuality.adaptivePollingMs;
    
    // Para leilão específico, ser mais agressivo
    if (auctionData?.status === 'active') {
      if (auctionData.time_left <= 30) {
        pollingInterval = 500; // Ultra frequente nos últimos 30s
      } else if (auctionData.time_left <= 120) {
        pollingInterval = 1000; // Muito frequente nos últimos 2 min
      } else {
        pollingInterval = Math.min(pollingInterval, 2000); // Máximo 2s para leilões ativos
      }
    }
    
    // Ajustar baseado na visibilidade
    if (!isVisible) {
      pollingInterval = Math.min(pollingInterval * 1.5, 5000);
    }
    
    // Ajustar baseado na conexão
    if (!isConnected) {
      pollingInterval = Math.min(pollingInterval / 2, 1000);
    }
    
    // Ajustar baseado no heartbeat
    if (!heartbeat.isAlive) {
      pollingInterval = 500; // Ultra agressivo quando heartbeat falha
    }

    console.log(`⏰ [${auctionId}] Polling: ${pollingInterval}ms (Active: ${auctionData?.status === 'active'}, Time: ${auctionData?.time_left}s, Connected: ${isConnected}, Heartbeat: ${heartbeat.isAlive})`);

    // Polling principal
    intervalRef.current = setInterval(() => {
      fetchAuctionData('POLL');
    }, pollingInterval);

    // Polling de emergência para situações críticas
    const needsEmergencyPolling = !isConnected || !heartbeat.isAlive || connectionQuality === 'critical' || 
                                 (auctionData?.status === 'active' && auctionData.time_left <= 10);

    if (needsEmergencyPolling) {
      emergencyIntervalRef.current = setInterval(() => {
        fetchAuctionData('EMERGENCY');
      }, 250); // 250ms de polling de emergência extremo
      
      console.log(`🚨 [${auctionId}] EMERGENCY-POLLING ativo (250ms)`);
    }

  }, [auctionId, networkQuality, isVisible, isConnected, heartbeat.isAlive, connectionQuality, auctionData?.status, auctionData?.time_left, fetchAuctionData]);

  // Reconectar quando página volta ao foco
  useEffect(() => {
    if (isVisible && (!isConnected || !heartbeat.isAlive) && auctionId) {
      console.log(`👁️ [${auctionId}] Página em foco, reconectando...`);
      initializeDetailRealtime();
      fetchAuctionData('FOCUS');
    }
  }, [isVisible, isConnected, heartbeat.isAlive, auctionId, initializeDetailRealtime, fetchAuctionData]);

  // Inicialização principal
  useEffect(() => {
    if (!auctionId) return;

    initializeDetailRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (emergencyIntervalRef.current) {
        clearInterval(emergencyIntervalRef.current);
      }
      if (finalizationTimeoutRef.current) {
        clearTimeout(finalizationTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setIsConnected(false);
    };
  }, [auctionId]); // Apenas auctionId como dependência

  // Verificar se leilão deve ser finalizado quando timer chega a zero
  const checkForFinalization = useCallback(async () => {
    if (!auctionId || !auctionData || auctionData.status !== 'active') return;

    console.log(`🏁 [FINALIZATION-CHECK] Timer zerou para leilão ${auctionId}, verificando últimos lances...`);
    
    try {
      // Buscar último lance para confirmar inatividade
      const { data: lastBids, error } = await supabase
        .from('bids')
        .select('created_at')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Erro ao verificar últimos lances:', error);
        return;
      }

      const now = new Date();
      const lastBidTime = lastBids && lastBids.length > 0 ? new Date(lastBids[0].created_at) : null;
      const secondsSinceLastBid = lastBidTime ? Math.floor((now.getTime() - lastBidTime.getTime()) / 1000) : Infinity;

      console.log(`🔍 [FINALIZATION-CHECK] Último lance há ${secondsSinceLastBid}s`);

      // Se não há lances recentes (15+ segundos), finalizar via Edge Function
      if (secondsSinceLastBid >= 15) {
        console.log(`✅ [FINALIZATION-START] Iniciando finalização do leilão ${auctionId}`);
        setIsWaitingFinalization(true);
        
        try {
          // Chamar Edge Function para finalizar leilão
          const { error: functionError } = await supabase.functions.invoke('finalize-auction', {
            body: { auction_id: auctionId }
          });

          if (functionError) {
            console.error('Erro ao chamar Edge Function de finalização:', functionError);
          } else {
            console.log(`🎯 [FINALIZATION] Edge Function chamada com sucesso para ${auctionId}`);
          }
        } catch (error) {
          console.error('Erro ao finalizar leilão:', error);
        }
        
        // Forçar sincronização para pegar o status atualizado
        setTimeout(() => fetchAuctionData(), 1000);
      } else {
        console.log(`⏳ [FINALIZATION-WAIT] Lance muito recente (${secondsSinceLastBid}s), aguardando...`);
        // Se houve lance recente, resetar timer para continuar
        setLocalTimeLeft(15 - secondsSinceLastBid);
      }
    } catch (error) {
      console.error('Erro ao verificar finalização:', error);
    }
  }, [auctionId, auctionData, fetchAuctionData]);

  // Timer visual decremental com finalização automática
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (localTimeLeft !== null && localTimeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            // Timer chegou a zero - verificar se deve finalizar
            checkForFinalization();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [localTimeLeft, checkForFinalization]);

  const forceSync = useCallback(() => {
    console.log(`🔄 [${auctionId}] Sincronização forçada`);
    fetchAuctionData('MANUAL');
  }, [fetchAuctionData, auctionId]);

  return {
    auctionData,
    isConnected,
    lastSync,
    forceSync,
    isWaitingFinalization,
    finalizationMessage,
    localTimeLeft,
    connectionQuality,
    networkQuality: networkQuality.quality,
    heartbeatStatus: heartbeat.isAlive,
    retryCount
  };
};