import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseIndependentTimerProps {
  auctionId: string;
  initialTimeLeft?: number;
}

export const useIndependentTimer = ({ auctionId, initialTimeLeft = 15 }: UseIndependentTimerProps) => {
  const [localTimer, setLocalTimer] = useState(0); // Começar em 0, será atualizado pelo backend
  const [lastBidCount, setLastBidCount] = useState<number>(0);
  const [isProtectionActive, setIsProtectionActive] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  // Buscar tempo real do backend usando a nova função
  const fetchRealTimeLeft = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_auction_time_left', { auction_uuid: auctionId });

      if (error) {
        console.error(`❌ [${auctionId}] Erro ao buscar tempo real:`, error);
        return initialTimeLeft; // Fallback para valor inicial
      }

      const realTimeLeft = data || 0;
      console.log(`🕐 [${auctionId}] Tempo real do backend: ${realTimeLeft}s`);
      return realTimeLeft;
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na RPC get_auction_time_left:`, error);
      return initialTimeLeft;
    }
  }, [auctionId, initialTimeLeft]);

  // Polling para detectar novos lances e sincronizar timer
  const checkForNewBids = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) return;

      // Se houve novos lances, buscar tempo real do backend
      if (data.total_bids > lastBidCount) {
        console.log(`🔄 [${auctionId}] Novo lance detectado! Sincronizando timer real (bids: ${lastBidCount} → ${data.total_bids})`);
        const realTimeLeft = await fetchRealTimeLeft();
        setLocalTimer(realTimeLeft);
        setLastBidCount(data.total_bids);
        setIsProtectionActive(false);
      }

      // Se leilão foi finalizado, parar timer
      if (data.status === 'finished') {
        setLocalTimer(0);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      }

      // Verificação de consistência: se timer local difere muito do real
      if (isInitialized && data.status === 'active' && Math.abs(Date.now() % 60000) < 1000) {
        const realTimeLeft = await fetchRealTimeLeft();
        const timeDiff = Math.abs(localTimer - realTimeLeft);
        
        if (timeDiff > 3) {
          console.log(`🔧 [${auctionId}] Correção de sincronização: ${localTimer}s → ${realTimeLeft}s (diff: ${timeDiff}s)`);
          setLocalTimer(realTimeLeft);
        }
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro no polling:`, error);
    }
  }, [auctionId, lastBidCount, fetchRealTimeLeft, isInitialized, localTimer]);

  // Chamar edge function de proteção quando timer chega a zero
  const triggerProtection = useCallback(async () => {
    if (isProtectionActive) return;
    
    setIsProtectionActive(true);
    console.log(`🛡️ [${auctionId}] Timer zerou! Acionando sistema de proteção...`);

    try {
      const { error } = await supabase.functions.invoke('auction-protection', {
        body: { auction_id: auctionId }
      });

      if (error) {
        console.error(`❌ [${auctionId}] Erro na edge function de proteção:`, error);
      } else {
        console.log(`✅ [${auctionId}] Sistema de proteção acionado com sucesso`);
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao acionar proteção:`, error);
    }
  }, [auctionId, isProtectionActive]);

  // Timer decremental visual (independente do backend)
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (localTimer > 0) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimer(prev => {
          const newValue = prev - 1;
          console.log(`⏰ [${auctionId}] Timer local: ${newValue}s`);
          
          if (newValue === 0) {
            // Timer chegou a zero - acionar proteção
            triggerProtection();
          }
          
          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [localTimer, auctionId, triggerProtection]);

  // Inicialização: buscar tempo real do backend e contagem de lances
  useEffect(() => {
    const initializeTimer = async () => {
      try {
        // Buscar dados iniciais do leilão
        const { data, error } = await supabase
          .from('auctions')
          .select('total_bids, status')
          .eq('id', auctionId)
          .single();

        if (data && !error) {
          setLastBidCount(data.total_bids);
          
          // Se leilão está ativo, buscar tempo real
          if (data.status === 'active') {
            const realTimeLeft = await fetchRealTimeLeft();
            setLocalTimer(realTimeLeft);
            console.log(`🚀 [${auctionId}] Timer inicializado com tempo real: ${realTimeLeft}s`);
          } else {
            setLocalTimer(0);
            console.log(`⏹️ [${auctionId}] Leilão não está ativo (status: ${data.status})`);
          }
        }
      } catch (error) {
        console.error(`❌ [${auctionId}] Erro ao inicializar timer:`, error);
        setLocalTimer(initialTimeLeft); // Fallback
      } finally {
        setIsInitialized(true);
      }
    };

    initializeTimer();

    // Polling a cada 1 segundo para detectar novos lances e verificar consistência
    pollingIntervalRef.current = setInterval(checkForNewBids, 1000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [auctionId, checkForNewBids, fetchRealTimeLeft, initialTimeLeft]);

  return {
    localTimer,
    isProtectionActive,
    isInitialized
  };
};